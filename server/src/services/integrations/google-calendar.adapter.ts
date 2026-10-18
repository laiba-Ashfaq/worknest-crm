import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

interface GoogleTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class GoogleCalendarAdapter {
  static isConfigured(): boolean {
    return Boolean(config.google.clientId && config.google.clientSecret);
  }

  static async getStatus(workspaceId: string, membershipId?: string) {
    let memberTokenExists = false;
    if (membershipId) {
      const member = await prisma.workspaceMembership.findUnique({
        where: { id: membershipId },
        select: { googleCalendarToken: true },
      });
      memberTokenExists = Boolean(member?.googleCalendarToken);
    }

    const isConnected = this.isConfigured() && memberTokenExists;

    return {
      provider: 'Google Calendar API',
      code: 'GOOGLE_CALENDAR',
      isConnected,
      statusLabel: isConnected ? 'Connected (Synced)' : 'Not Connected',
      capabilities: [
        'OAuth 2.0 User Calendar Sync',
        'Automatic Conflict Detection',
        'Appointment Creation & Rescheduling',
        'Timezone Handling (Asia/Karachi default)',
      ],
      setupInstructions:
        'To connect: Set up a Google Cloud Console Project, enable Google Calendar API, create OAuth 2.0 Web Client credentials, and set authorized redirect URI to ' +
        config.google.redirectUri,
    };
  }

  static createAuthorizationUrl(workspaceId: string, membershipId: string, userId: string): string {
    if (!this.isConfigured()) {
        throw new Error('Google Calendar OAuth is not configured.');
    }

    const state = jwt.sign(
        { workspaceId, membershipId, userId },
        config.jwtSecret,
        { expiresIn: '10m' }
    );
    const params = new URLSearchParams({
        client_id: config.google.clientId,
        redirect_uri: config.google.redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_SCOPE,
        state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  static async handleOAuthCallback(code: string, state: string): Promise<string> {
    const payload = jwt.verify(state, config.jwtSecret) as {
        workspaceId: string;
        membershipId: string;
        userId: string;
    };

    const tokenResponse = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: config.google.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokenData = tokenResponse.data as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };

    if (!tokenData.access_token) {
        throw new Error('Google did not return an access token.');
    }

    const existing = await prisma.workspaceMembership.findUnique({
        where: { id: payload.membershipId },
        select: { googleCalendarToken: true },
    });
    const previous = existing?.googleCalendarToken
        ? JSON.parse(existing.googleCalendarToken) as GoogleTokenData
        : undefined;

    await prisma.workspaceMembership.update({
        where: { id: payload.membershipId },
        data: {
          googleCalendarToken: JSON.stringify({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || previous?.refreshToken,
            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          } satisfies GoogleTokenData),
        },
    });

    return payload.workspaceId;
  }

  /**
   * Check for appointment scheduling conflicts for a representative.
   */
  static async checkConflict(
    workspaceId: string,
    hostMembershipId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string
  ): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
    const conflicting = await prisma.appointment.findFirst({
      where: {
        workspaceId,
        hostMembershipId,
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        OR: [
          // New start is within existing slot
          {
            startTime: { lte: startTime },
            endTime: { gt: startTime },
          },
          // New end is within existing slot
          {
            startTime: { lt: endTime },
            endTime: { gte: endTime },
          },
          // Existing slot is completely inside new slot
          {
            startTime: { gte: startTime },
            endTime: { lte: endTime },
          },
        ],
      },
      include: { contact: true },
    });

    return {
      hasConflict: Boolean(conflicting),
      conflictingAppointment: conflicting,
    };
  }

  /**
   * Create an appointment and optionally sync to Google Calendar if OAuth connected.
   */
  static async syncAppointmentToGoogle(appointmentId: string) {
    if (!this.isConfigured()) {
      return { synced: false, reason: 'Google Calendar OAuth not configured.' };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { hostRep: true, contact: true },
    });

    if (!appointment || !appointment.hostRep.googleCalendarToken) {
      return { synced: false, reason: 'Host has not connected their Google Calendar.' };
    }

    try {
      const token = JSON.parse(appointment.hostRep.googleCalendarToken) as GoogleTokenData;
      let accessToken = token.accessToken;

      if (!token.refreshToken) {
        return { synced: false, reason: 'Google Calendar refresh token is missing.' };
      }

      if (!token.expiresAt || token.expiresAt <= Date.now() + 60_000) {
        const refreshed = await axios.post(
          GOOGLE_TOKEN_URL,
          new URLSearchParams({
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            refresh_token: token.refreshToken,
            grant_type: 'refresh_token',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        accessToken = refreshed.data.access_token;
        await prisma.workspaceMembership.update({
          where: { id: appointment.hostMembershipId },
          data: {
            googleCalendarToken: JSON.stringify({
              ...token,
              accessToken,
              expiresAt: Date.now() + (refreshed.data.expires_in || 3600) * 1000,
            } satisfies GoogleTokenData),
          },
        });
      }

      const eventResponse = await axios.post(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          summary: appointment.title,
          description: appointment.description || undefined,
          location: appointment.location || undefined,
          start: { dateTime: appointment.startTime.toISOString() },
          end: { dateTime: appointment.endTime.toISOString() },
          attendees: appointment.contact.email ? [{ email: appointment.contact.email }] : undefined,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      return { synced: true, calendarEventId: eventResponse.data.id as string };
    } catch (err: any) {
      console.error('[GoogleCalendarAdapter] Calendar event sync failed:', err.response?.data || err.message);
      return { synced: false, error: 'Google Calendar event creation failed.' };
    }
  }
}
