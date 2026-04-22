export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: 'Homeowner' | 'Developer';
  jobDescription: string;
  estimate: number;
  actualBudget: number;
  createdAt: string;
}

export interface Estimate {
  contractorId: string;
  contractorName: string;
  amount: number;
  submittedAt: string;
  type: 'rough' | 'final';
}

export interface Project {
  id: string;
  uid: string;
  title: string;
  description?: string;
  clientId?: string;
  status: 'New Open Project' | 'Rough Estimates' | 'Final Estimates' | 'On Hold' | 'In Contract' | 'In Progress' | 'Completed' | 'Abandoned';
  budget: number;
  startDate: string;
  endDate?: string;
  category: string;
  imageUrl?: string;
  photos?: string[];
  location?: {
    street: string;
    town: string;
    zip: string;
  };
  phone?: string;
  services?: string[];
  photoCount?: number;
  roughEstimates?: Estimate[];
  finalEstimates?: Estimate[];
  selectedContractorId?: string;
  expirationDate?: string;
  inspectionDate?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'Todo' | 'In Progress' | 'Done';
  dueDate: string;
  assignedTo: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  date: string;
}

export interface DOBPermit {
  id: string;
  jobFilingNumber?: string;
  borough: string;
  house_number: string;
  street_name: string;
  address?: string;
  zip_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  job_type: string;
  permit_status: string;
  filing_date: string;
  issuance_date: string;
  job_description: string;
  owner_name: string;
  owner_business_name: string;
  applicant_business_name?: string;
  estimated_job_costs?: number;
  applicant_license?: string;
  contact_name?: string;
  phone?: string;
  licensed_business_name?: string;
  licensed_contact_name?: string;
  licensed_phone?: string;
  license_status?: string;
  license_type?: string;
  potential_owner_name?: string;
  potential_owner_phone?: string;
  business_phone?: string;
  business_phone_source?: string;
  owner_path_source?: string;
  contact_confidence?: 'Verified' | 'Business Only' | 'Public Agency' | 'License Only' | 'Conflict' | 'Unresolved';
  entity_type?: FilingEntityType;
  lead_path?: FilingLeadPath;
  crosswalk_confidence?: CrosswalkConfidence;
  crosswalk_source_type?: CrosswalkSourceType;
  crosswalk_last_verified_at?: string;
  source?: string;
  related_filing_count?: number;
  zip_conflict?: boolean;
  alternate_zip_codes?: string[];
  duplicate_group_key?: string;
}

export type ElevatorOpportunityTier = 'High' | 'Medium' | 'Watch';

export interface ElevatorIntelligenceSourceStatus {
  key: string;
  label: string;
  sourceUrl: string;
  count: number;
  latestAt?: string;
  note: string;
}

export interface ElevatorOpportunity {
  id: string;
  jobFilingNumber: string;
  address: string;
  borough: string;
  zipCode?: string;
  bbl?: string;
  ownerName?: string;
  managementCompany?: string;
  applicantBusinessName?: string;
  buildingType?: string;
  estimatedCost?: number;
  filingDate?: string;
  permitStatus?: string;
  filingIncludes?: string;
  descriptionOfWork?: string;
  deviceId?: string;
  deviceType?: string;
  deviceStatus?: string;
  elevatorType?: string;
  latestCertificateOfOccupancyDate?: string;
  recentSaleDate?: string;
  recentSaleAmount?: number;
  recentRecordedParty?: string;
  hpdRegistrationDate?: string;
  hpdRegistrationEndDate?: string;
  complaintCount311?: number;
  lastComplaintDate311?: string;
  complaintDescriptor311?: string;
  activeModernizationFiling?: boolean;
  modernizationSignalScore: number;
  modernizationSignalTier: ElevatorOpportunityTier;
  signalSummary: string[];
  recommendedAction: string;
}

export type FilingEntityType =
  | 'Contractor'
  | 'Architect / Engineer'
  | 'Expediter'
  | 'Developer / Owner'
  | 'Business / Organization'
  | 'Public Agency'
  | 'Unknown';

export type FilingLeadPath = 'Direct' | 'Indirect' | 'Procurement' | 'Noise' | 'Unknown';

export type CrosswalkConfidence = 'High' | 'Medium' | 'Low' | 'Unresolved';

export type CrosswalkSourceType =
  | 'Contractor Database'
  | 'Professional License'
  | 'Business Registry'
  | 'Property Record'
  | 'Internal Override'
  | 'Search Discovery'
  | 'User Verified'
  | 'Unknown';

export type CrosswalkRecordStatus = 'candidate' | 'verified' | 'rejected';

export interface FilingContactCrosswalkRecord {
  id: string;
  applicant_license?: string;
  normalized_applicant_name?: string;
  normalized_business_name?: string;
  normalized_address?: string;
  borough?: string;
  zip_code?: string;
  entity_type: FilingEntityType;
  lead_path: FilingLeadPath;
  contact_name?: string;
  business_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  source_name?: string;
  source_type: CrosswalkSourceType;
  source_record_id?: string;
  status: CrosswalkRecordStatus;
  confidence: CrosswalkConfidence;
  match_score?: number;
  matched_on?: string[];
  last_verified_at?: string;
  notes?: string;
}

export interface PublicContractOpportunity {
  id: string;
  source: 'PASSPort';
  record_type: 'open_bid' | 'awarded_contract';
  title: string;
  agency: string;
  status: string;
  industry?: string;
  main_commodity?: string;
  procurement_method?: string;
  contract_id?: string;
  epin?: string;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  amount?: number | null;
  estimated_value?: number | null;
  due_date?: string;
  award_date?: string;
  registration_date?: string;
  source_url?: string;
  improvement_types?: string[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  description: string;
  startDate?: string;
  status: 'New Lead' | 'Contacted' | 'Converted' | 'Closed';
  location?: {
    street?: string;
    town?: string;
    zip?: string;
  };
  photoCount?: number;
  photos?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LeadMarketplaceItem {
  id: string;
  leadId: string;
  category: string;
  description: string;
  status: 'Open' | 'Requested' | 'Assigned' | 'Closed';
  location?: {
    town?: string;
    zip?: string;
  };
  photoCount?: number;
  photos?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LeadInquiry {
  id: string;
  leadId: string;
  contractorId: string;
  contractorName: string;
  contractorEmail: string;
  message: string;
  status:
    | 'Requested'
    | 'Admin Reviewing'
    | 'Homeowner Contact Pending'
    | 'Homeowner Confirmed'
    | 'Introduction Approved'
    | 'Declined'
    | 'Closed';
  createdAt: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
  reviewedBy?: {
    id?: string;
    name?: string;
  };
  approvedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  homeownerContactedAt?: string;
  homeownerConfirmedAt?: string;
  introductionThreadId?: string;
  lastCommunicationAt?: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  inquiryId?: string;
  eventType: 'status_changed' | 'admin_message_sent';
  recipientType?: 'homeowner' | 'home-pro';
  message: string;
  actorId?: string;
  actorName?: string;
  createdAt: string;
}

export interface LeadInquiryNote {
  id: string;
  inquiryId: string;
  body: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
}

export interface LeadInquiryHistory {
  id: string;
  inquiryId: string;
  eventType:
    | 'request_created'
    | 'status_changed'
    | 'note_added'
    | 'homeowner_email_sent'
    | 'home_pro_email_sent'
    | 'introduction_approved'
    | 'request_declined';
  message: string;
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export type UserRole = 'Homeowner' | 'Contractor' | 'admin';

export interface UserAccount {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  rating?: number;
  isVerified?: boolean;
  isDisabled?: boolean;
  licenseStatus?: 'Active' | 'Pending' | 'Expired' | 'Invalid';
  accountPlan?: 'trial' | 'standard';
  trialStartedAt?: string;
  trialEndsAt?: string;
  subscriptionLevel?: 'none' | 'trial' | 'beginner' | 'junior' | 'pro';
}

export interface UserProfile {
  id: string;
  uid: string;
  name?: string;
  phone?: string;
  street?: string;
  town?: string;
  zip?: string;
  avatar?: string;
  governmentIdImage?: string;
  portfolioImages?: string[];
  licenseNumber?: string;
  isTradesman?: boolean;
  trade?: string;
  notifyOnNewProjects?: boolean;
  notifyOnRoughEstimates?: boolean;
  notifyOnProductUpdates?: boolean;
  notifyOnSmsLeadAlerts?: boolean;
  smsConsentAt?: string;
  leadCategories?: string[];
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  street?: string;
  town?: string;
  zip?: string;
  avatar?: string;
  portfolioImages?: string[];
  rating?: number;
  isVerified?: boolean;
  governmentIdImage?: string;
  licenseNumber?: string;
  licenseStatus?: 'Active' | 'Pending' | 'Expired' | 'Invalid';
  isTradesman?: boolean;
  trade?: string;
  accountPlan?: 'trial' | 'standard';
  trialStartedAt?: string;
  trialEndsAt?: string;
  subscriptionLevel?: 'none' | 'trial' | 'beginner' | 'junior' | 'pro';
  notifyOnNewProjects?: boolean;
  notifyOnRoughEstimates?: boolean;
  notifyOnProductUpdates?: boolean;
  notifyOnSmsLeadAlerts?: boolean;
  smsConsentAt?: string;
  leadCategories?: string[];
}
