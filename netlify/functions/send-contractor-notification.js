import {
  createEmailLogContext,
  getAdminEmail,
  renderIntroEmail,
  sendLoggedIntroEmail,
} from './_intro-email.js';

export const getContractorNotificationContent = ({
  eventType,
  contractorName,
  projectTitle,
  category,
  town,
  amount,
  estimateType,
  requestedVisitDate,
}) => {
  switch (eventType) {
    case 'signup_confirmation':
      return {
        subject: 'Blueprint Home Pro signup received',
        heading: 'Home Pro Signup Received',
        bodyLines: [
          'Blueprint received your contractor signup and your account has been created.',
          'Your account remains unverified until Blueprint completes its review. You can still finish your profile and access your portal while review is pending.',
        ],
        detailLines: [
          '<strong>Status:</strong> Account created',
          '<strong>Verification:</strong> Pending Blueprint review',
          '<strong>Next step:</strong> Blueprint will review your profile before marketplace access is approved',
        ],
      };
    case 'intro_request_acknowledgment':
      return {
        subject: `Blueprint received your ${category || 'project'} introduction request`,
        heading: 'Introduction Request Received',
        bodyLines: [
          'Blueprint received your request and will review it before any homeowner introduction is approved.',
          'We will keep you updated as the request moves through the review process.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${category || 'Project request'}`,
          `<strong>Area:</strong> ${town || 'Local service area'}`,
          '<strong>Status:</strong> Requested',
        ],
      };
    case 'estimate_confirmation':
      return {
        subject: `${estimateType === 'final' ? 'Final' : 'Rough'} estimate submitted for ${projectTitle || 'project lead'}`,
        heading: `${estimateType === 'final' ? 'Final' : 'Rough'} Estimate Submitted`,
        bodyLines: [
          `Blueprint recorded your ${estimateType === 'final' ? 'final' : 'rough'} estimate submission.`,
          'You can return to the Home Pro portal at any time to monitor project status and next steps.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${projectTitle || 'Project lead'}`,
          `<strong>Estimate type:</strong> ${estimateType === 'final' ? 'Final estimate' : 'Rough estimate'}`,
          `<strong>Amount:</strong> $${Number(amount || 0).toLocaleString()}`,
        ],
      };
    case 'inspection_request_confirmation':
      return {
        subject: `Inspection request sent for ${projectTitle || 'project lead'}`,
        heading: 'Inspection Request Sent',
        bodyLines: [
          'Blueprint recorded your request to schedule an in-person inspection.',
          'You can monitor the homeowner response and project status from the Home Pro portal.',
        ],
        detailLines: [
          `<strong>Project:</strong> ${projectTitle || 'Project lead'}`,
          `<strong>Requested inspection date:</strong> ${requestedVisitDate || 'Not specified'}`,
        ],
      };
    default:
      throw new Error('Unsupported contractor notification event');
  }
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const {
    eventType,
    contractorEmail,
    contractorName,
    projectTitle,
    category,
    town,
    amount,
    estimateType,
    requestedVisitDate,
    replyTo,
  } = JSON.parse(event.body || '{}');

  if (!contractorEmail) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Contractor email is required' }),
    };
  }

  if (!eventType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Notification event type is required' }),
    };
  }

  try {
    const content = getContractorNotificationContent({
      eventType,
      contractorName,
      projectTitle,
      category,
      town,
      amount,
      estimateType,
      requestedVisitDate,
    });

    const info = await sendLoggedIntroEmail({
      logContext: createEmailLogContext({
        handlerName: 'send-contractor-notification',
        eventType,
        recipient: contractorEmail,
        metadata: {
          contractorName,
          projectTitle,
          category,
          town,
        },
      }),
      mail: {
        to: contractorEmail,
        cc: getAdminEmail(),
        replyTo,
        subject: content.subject,
        html: renderIntroEmail({
          heading: content.heading,
          greeting: `Hi ${contractorName || 'Home Pro'},`,
          bodyLines: content.bodyLines,
          detailLines: content.detailLines,
        }),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: info.messageId, eventType }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send contractor notification',
        eventType,
      }),
    };
  }
};
