export type ContractorNotificationType =
  | 'signup_confirmation'
  | 'intro_request_acknowledgment'
  | 'estimate_confirmation'
  | 'inspection_request_confirmation';

type ContractorNotificationPayload = {
  eventType: ContractorNotificationType;
  contractorEmail: string;
  contractorName?: string;
  projectTitle?: string;
  category?: string;
  town?: string;
  amount?: number;
  estimateType?: 'rough' | 'final';
  requestedVisitDate?: string;
  replyTo?: string;
};

const CONTRACTOR_NOTIFICATION_LABELS: Record<ContractorNotificationType, string> = {
  signup_confirmation: 'signup confirmation email',
  intro_request_acknowledgment: 'introduction request acknowledgment email',
  estimate_confirmation: 'estimate confirmation email',
  inspection_request_confirmation: 'inspection request confirmation email',
};

export function getContractorNotificationLabel(eventType: ContractorNotificationType) {
  return CONTRACTOR_NOTIFICATION_LABELS[eventType];
}

export async function sendContractorNotification(payload: ContractorNotificationPayload) {
  const response = await fetch('/api/send-contractor-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.details ||
        response.statusText ||
        `Failed to send ${getContractorNotificationLabel(payload.eventType)}`
    );
  }

  return data;
}
