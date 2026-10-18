import nodemailer from 'nodemailer';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';

export interface EscalationAlertData {
  leadTitle: string;
  customerName: string;
  customerPhone: string;
  escalationReason: string;
  currentOwner: string;
  leadId: string;
}

export class SmtpAdapter {
  static isConfigured(): boolean {
    return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
  }

  static async getStatus(workspaceId: string) {
    const isConnected = this.isConfigured();

    return {
      provider: 'SMTP Email Service',
      code: 'SMTP',
      isConnected,
      statusLabel: isConnected ? 'Connected' : 'Not Connected',
      capabilities: [
        'Escalation Email Notifications',
        'Manager Recovery Alerts',
        'Custom SMTP Server Support (Mailtrap, Sendgrid, Postmark)',
      ],
      setupInstructions:
        'To connect: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in your environment configuration or workspace integration settings.',
    };
  }

  /**
   * Send escalation email alert to workspace managers/owners.
   */
  static async sendEscalationAlert(workspaceId: string, alertData: EscalationAlertData) {
    if (!this.isConfigured()) {
      // Graceful logging if SMTP is not configured
      console.log(`[SmtpAdapter] SMTP not configured. Skipped email alert for escalated lead: ${alertData.leadTitle}`);
      return { sent: false, reason: 'SMTP not configured' };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });

      // Find managers/owner of the workspace
      const managers = await prisma.workspaceMembership.findMany({
        where: {
          workspaceId,
          status: 'ACTIVE',
          role: {
            name: { in: ['Owner', 'Admin', 'Manager'] },
          },
        },
        include: { user: true },
      });

      const recipientEmails = managers.map((m) => m.user.email).filter(Boolean);

      if (recipientEmails.length === 0) {
        return { sent: false, reason: 'No manager emails found for workspace.' };
      }

      const leadUrl = `${config.clientUrl}/leads?id=${alertData.leadId}`;

      const mailOptions = {
        from: config.smtp.from,
        to: recipientEmails.join(', '),
        subject: `[WorkNest Escalation Alert] Lead Unattended: ${alertData.leadTitle}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #043873; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px;">WorkNest Escalation Alert</h2>
            </div>
            <p style="color: #212529; font-size: 15px;">A sales lead has exceeded its acknowledgement SLA and requires immediate attention.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; color: #718096; width: 35%;">Lead:</td>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-weight: 600;">${alertData.leadTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; color: #718096;">Customer:</td>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7;">${alertData.customerName} (${alertData.customerPhone})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; color: #718096;">Assigned Rep:</td>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7;">${alertData.currentOwner}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; color: #718096;">Escalation Reason:</td>
                <td style="padding: 8px; border-bottom: 1px solid #edf2f7; color: #e53e3e; font-weight: 600;">${alertData.escalationReason}</td>
              </tr>
            </table>

            <div style="margin-top: 24px;">
              <a href="${leadUrl}" style="background-color: #4F9CF9; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">View and Reassign Lead</a>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      await prisma.integrationLog.create({
        data: {
          workspaceId,
          provider: 'SMTP',
          direction: 'OUTBOUND',
          eventType: 'ESCALATION_EMAIL_SENT',
          status: 'SUCCESS',
          payloadRedacted: JSON.stringify({ leadId: alertData.leadId, recipients: recipientEmails }),
        },
      });

      return { sent: true };
    } catch (err: any) {
      console.error('[SmtpAdapter] Failed to send email alert:', err);
      await prisma.integrationLog.create({
        data: {
          workspaceId,
          provider: 'SMTP',
          direction: 'OUTBOUND',
          eventType: 'ESCALATION_EMAIL_FAILED',
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      return { sent: false, error: err.message };
    }
  }
}
