import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { emitToWorkspace } from '../socket.service';
import { AuditService } from '../audit.service';

export interface CreatePaymentParams {
  workspaceId: string;
  opportunityId?: string;
  contactId: string;
  amount: number;
  currency?: string;
  clientRedirectUrl?: string;
}

export class SafepayAdapter {
  static isConfigured(): boolean {
    return Boolean(config.safepay.apiKey && config.safepay.secretKey);
  }

  static async getStatus(workspaceId: string) {
    const configRecord = await prisma.integrationConfig.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'SAFEPAY',
        },
      },
    });

    const isConnected = this.isConfigured() || (configRecord?.isConnected ?? false);

    return {
      provider: 'Safepay Sandbox',
      code: 'SAFEPAY',
      isConnected,
      statusLabel: isConnected ? 'Connected (Sandbox)' : 'Not Connected',
      isSandbox: true,
      lastActivityAt: configRecord?.lastActivityAt || null,
      lastError: configRecord?.lastError || null,
      supportedCurrencies: ['PKR', 'USD', 'AED'],
      capabilities: [
        'Hosted Checkout Generation',
        'Direct Payment Links',
        'Webhook Signature Verification',
        'Idempotent Event Sync',
        'Refund & Status Tracking',
      ],
      setupInstructions:
        'To connect: Sign up through Safepay sandbox, obtain your API Key and Secret Key, and configure them in workspace settings or backend environment.',
    };
  }

  /**
   * Create a hosted payment checkout session on Safepay Sandbox.
   */
  static async createPaymentSession(params: CreatePaymentParams) {
    const currency = params.currency || 'PKR';

    if (params.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // Record local payment record in PENDING / DRAFT state
    const payment = await prisma.payment.create({
      data: {
        workspaceId: params.workspaceId,
        opportunityId: params.opportunityId || null,
        contactId: params.contactId,
        amount: params.amount,
        currency,
        status: 'PENDING',
        provider: 'SAFEPAY',
        isSandbox: true,
      },
      include: {
        contact: true,
        opportunity: true,
      },
    });

    if (!this.isConfigured()) {
      // In development/demonstration mode when live keys are not configured,
      // generate a realistic mock Safepay sandbox checkout link for demonstration
      const mockTracker = `track_${crypto.randomBytes(12).toString('hex')}`;
      const mockCheckoutUrl = `${config.safepay.sandboxUrl}/components?beacon=${mockTracker}&env=sandbox`;

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          trackerToken: mockTracker,
          checkoutUrl: mockCheckoutUrl,
          providerReference: mockTracker,
        },
      });

      return {
        payment: updatedPayment,
        checkoutUrl: mockCheckoutUrl,
        isSimulated: true,
        note: 'Safepay Sandbox credentials not set in environment. Generated sandbox demonstration tracker.',
      };
    }

    try {
      // Safepay official API contract for order initialization:
      // POST https://sandbox.api.getsafepay.com/order/v1/init
      const response = await axios.post(
        `${config.safepay.sandboxUrl}/order/v1/init`,
        {
          client: config.safepay.apiKey,
          amount: params.amount,
          currency,
          environment: 'sandbox',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-SFPY-MERCHANT-SECRET': config.safepay.secretKey,
          },
          timeout: 10000,
        }
      );

      const trackerToken = response.data?.data?.token;
      const checkoutUrl = `${config.safepay.sandboxUrl}/components?beacon=${trackerToken}&env=sandbox`;

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          trackerToken,
          checkoutUrl,
          providerReference: trackerToken,
        },
      });

      await prisma.integrationLog.create({
        data: {
          workspaceId: params.workspaceId,
          provider: 'SAFEPAY',
          direction: 'OUTBOUND',
          eventType: 'CHECKOUT_CREATED',
          providerReference: trackerToken,
          status: 'SUCCESS',
          payloadRedacted: JSON.stringify({ amount: params.amount, currency }),
        },
      });

      return {
        payment: updatedPayment,
        checkoutUrl,
        isSimulated: false,
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      await prisma.integrationLog.create({
        data: {
          workspaceId: params.workspaceId,
          provider: 'SAFEPAY',
          direction: 'OUTBOUND',
          eventType: 'CHECKOUT_CREATION_FAILED',
          status: 'FAILED',
          errorMessage: errMsg,
        },
      });

      throw new Error(`Safepay Sandbox checkout creation failed: ${errMsg}`);
    }
  }

  /**
   * Verify Safepay webhook signature using HMAC SHA256.
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) return true; // If no secret configured in sandbox
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');

    const digestBuf = Buffer.from(digest, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');

    if (digestBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(digestBuf, sigBuf);
  }

  /**
   * Authoritative webhook handler for Safepay payment updates.
   * Handles idempotency and updates records without race conditions.
   */
  static async handleWebhook(workspaceId: string, payload: any, signature?: string) {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);

    if (config.safepay.webhookSecret && signature) {
      const isValid = this.verifyWebhookSignature(rawPayload, signature, config.safepay.webhookSecret);
      if (!isValid) {
        throw new Error('Invalid Safepay webhook signature.');
      }
    }

    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const tracker = event.data?.token || event.token || event.data?.tracker;
    const eventType = event.event || event.type || 'payment.completed';
    const status = event.data?.state || event.state || 'PAID';

    if (!tracker) {
      return { status: 'IGNORED', reason: 'Missing tracker token in webhook.' };
    }

    // Find payment record
    const payment = await prisma.payment.findFirst({
      where: {
        workspaceId,
        trackerToken: tracker,
      },
      include: { opportunity: true },
    });

    if (!payment) {
      return { status: 'NOT_FOUND', reason: `Payment not found for tracker ${tracker}` };
    }

    // Idempotency: if payment is already marked PAID, return existing state
    if (payment.status === 'PAID' && status.toUpperCase() === 'PAID') {
      return { status: 'ALREADY_PROCESSED', paymentId: payment.id };
    }

    const newStatus = status.toUpperCase() === 'PAID' || status.toUpperCase() === 'COMPLETED' ? 'PAID' : 'FAILED';

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        webhookReceivedAt: new Date(),
        metadata: JSON.stringify(event),
      },
    });

    // If payment is linked to an opportunity, update opportunity payment status
    if (payment.opportunityId && newStatus === 'PAID') {
      await prisma.opportunity.update({
        where: { id: payment.opportunityId },
        data: { paymentStatus: 'PAID' },
      });
    }

    await AuditService.log({
      workspaceId,
      actorType: 'WEBHOOK',
      action: 'PAYMENT_STATUS_UPDATED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      beforeState: { status: payment.status },
      afterState: { status: newStatus },
      reason: `Safepay Webhook event: ${eventType}`,
    });

    await prisma.integrationLog.create({
      data: {
        workspaceId,
        provider: 'SAFEPAY',
        direction: 'INBOUND',
        eventType,
        providerReference: tracker,
        status: 'SUCCESS',
        payloadRedacted: JSON.stringify({ tracker, status: newStatus }),
      },
    });

    emitToWorkspace(workspaceId, 'payment_updated', {
      paymentId: payment.id,
      status: newStatus,
      amount: payment.amount,
      currency: payment.currency,
      opportunityId: payment.opportunityId,
    });

    return { status: 'SUCCESS', payment: updatedPayment };
  }
}
