import axios from 'axios';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { AssignmentService } from '../assignment.service';
import { emitToWorkspace } from '../socket.service';

export interface WhatsAppMessagePayload {
  toPhone: string;
  messageText: string;
}

export class WhatsAppAdapter {
  static isConfigured(): boolean {
    return Boolean(config.whatsapp.phoneNumberId && config.whatsapp.accessToken);
  }

  static async getStatus(workspaceId: string) {
    const configRecord = await prisma.integrationConfig.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'WHATSAPP',
        },
      },
    });

    const isConnected = this.isConfigured() || (configRecord?.isConnected ?? false);

    return {
      provider: 'Meta WhatsApp Cloud API',
      code: 'WHATSAPP',
      isConnected,
      statusLabel: isConnected ? 'Connected' : 'Not Connected',
      lastActivityAt: configRecord?.lastActivityAt || null,
      lastError: configRecord?.lastError || null,
      capabilities: [
        'Two-way WhatsApp Messaging',
        'Incoming Webhook Auto-lead Capture',
        'Customer Profile Association',
        'Opt-out Enforcement',
      ],
      setupInstructions:
        'To connect: Create a Meta for Developers app, configure WhatsApp Business API, add your Phone Number ID and System User Access Token in workspace settings or environment variables.',
    };
  }

  /**
   * Send WhatsApp message via Meta WhatsApp Cloud API.
   * If credentials are not configured, returns clear unconfigured state.
   */
  static async sendMessage(
    workspaceId: string,
    conversationId: string,
    toPhone: string,
    messageText: string,
    senderMembershipId?: string
  ) {
    if (!this.isConfigured()) {
      throw new Error(
        'Meta WhatsApp Cloud API is not connected. Please configure WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.'
      );
    }

    // Check contact opt-out status
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });

    if (conversation?.contact.consentStatus === 'OPTED_OUT') {
      throw new Error('Message blocked: Contact has opted out of messaging.');
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${config.whatsapp.phoneNumberId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { preview_url: false, body: messageText },
        },
        {
          headers: {
            Authorization: `Bearer ${config.whatsapp.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const externalMessageId = response.data?.messages?.[0]?.id || null;

      const message = await prisma.message.create({
        data: {
          workspaceId,
          conversationId,
          direction: 'OUTBOUND',
          senderId: senderMembershipId || 'SYSTEM',
          content: messageText,
          channel: 'WHATSAPP',
          externalMessageId,
          status: 'SENT',
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Log successful integration event
      await prisma.integrationLog.create({
        data: {
          workspaceId,
          provider: 'WHATSAPP',
          direction: 'OUTBOUND',
          eventType: 'MESSAGE_SENT',
          providerReference: externalMessageId,
          status: 'SUCCESS',
          payloadRedacted: JSON.stringify({ to: toPhone, preview: messageText.substring(0, 30) }),
        },
      });

      emitToWorkspace(workspaceId, 'message_sent', { conversationId, message });

      return message;
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message || 'WhatsApp API request failed';

      // Log failed integration event
      await prisma.integrationLog.create({
        data: {
          workspaceId,
          provider: 'WHATSAPP',
          direction: 'OUTBOUND',
          eventType: 'MESSAGE_FAILED',
          status: 'FAILED',
          errorMessage: errMsg,
          payloadRedacted: JSON.stringify({ to: toPhone }),
        },
      });

      throw new Error(`WhatsApp delivery failed: ${errMsg}`);
    }
  }

  /**
   * Process incoming webhook from Meta WhatsApp Cloud API.
   */
  static async handleIncomingWebhook(workspaceId: string, webhookPayload: any) {
    try {
      const entry = webhookPayload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return { status: 'IGNORED', reason: 'No message payload in webhook change.' };
      }

      const fromPhone = '+' + message.from;
      const messageText = message.text?.body || '[Non-text message]';
      const externalMessageId = message.id;

      // Deduplicate incoming messages
      const existingMsg = await prisma.message.findFirst({
        where: { externalMessageId },
      });

      if (existingMsg) {
        return { status: 'DUPLICATE', messageId: existingMsg.id };
      }

      // Find or create Contact
      let contact = await prisma.contact.findFirst({
        where: {
          workspaceId,
          phone: { contains: message.from.slice(-10) },
        },
      });

      let isNewLead = false;

      if (!contact) {
        isNewLead = true;
        const customerName = value?.contacts?.[0]?.profile?.name || `WhatsApp User ${fromPhone.slice(-4)}`;

        contact = await prisma.contact.create({
          data: {
            workspaceId,
            name: customerName,
            phone: fromPhone,
            leadSource: 'WHATSAPP',
          },
        });
      }

      // Find or create active conversation
      let conversation = await prisma.conversation.findFirst({
        where: { workspaceId, contactId: contact.id, channel: 'WHATSAPP' },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            channel: 'WHATSAPP',
            status: 'ACTIVE',
          },
        });
      }

      // Store incoming message
      const savedMessage = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          direction: 'INBOUND',
          senderId: fromPhone,
          content: messageText,
          channel: 'WHATSAPP',
          externalMessageId,
          status: 'DELIVERED',
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // If new contact, automatically create a Lead and assign via Assignment Engine!
      if (isNewLead) {
        const lead = await prisma.lead.create({
          data: {
            workspaceId,
            contactId: contact.id,
            title: `New WhatsApp Inquiry from ${contact.name}`,
            source: 'WHATSAPP',
            priority: 'HIGH',
            notes: `Initial message: ${messageText}`,
          },
        });

        await AssignmentService.assignLead(workspaceId, lead.id, 'INITIAL_ROUND_ROBIN', {
          type: 'SYSTEM',
          name: 'WhatsApp Inbound Engine',
        });
      }

      // Log integration event
      await prisma.integrationLog.create({
        data: {
          workspaceId,
          provider: 'WHATSAPP',
          direction: 'INBOUND',
          eventType: 'MESSAGE_RECEIVED',
          providerReference: externalMessageId,
          status: 'SUCCESS',
          payloadRedacted: JSON.stringify({ from: fromPhone, preview: messageText.substring(0, 30) }),
        },
      });

      emitToWorkspace(workspaceId, 'incoming_message', {
        conversationId: conversation.id,
        contactId: contact.id,
        message: savedMessage,
      });

      return { status: 'SUCCESS', messageId: savedMessage.id, contactId: contact.id };
    } catch (err: any) {
      console.error('[WhatsAppAdapter] Error processing incoming webhook:', err);
      throw err;
    }
  }
}
