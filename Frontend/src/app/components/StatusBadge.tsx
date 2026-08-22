interface StatusBadgeProps {
  status: string;
  label?: string;
}

// Map backend status values to display config
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  // Vehicle statuses
  'Available':   { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Available' },
  'OnTrip':      { bg: 'bg-[#FACC15]/10', text: 'text-[#FACC15]', label: 'On Trip' },
  'InShop':      { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'In Shop' },
  'Retired':     { bg: 'bg-[#A1A1AA]/10', text: 'text-[#A1A1AA]', label: 'Retired' },
  // Trip statuses
  'Draft':       { bg: 'bg-[#A1A1AA]/10', text: 'text-[#A1A1AA]', label: 'Draft' },
  'Dispatched':  { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', label: 'Dispatched' },
  'Completed':   { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Completed' },
  'Cancelled':   { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'Cancelled' },
  // Driver statuses
  'OnDuty':      { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'On Duty' },
  'OffDuty':     { bg: 'bg-[#A1A1AA]/10', text: 'text-[#A1A1AA]', label: 'Off Duty' },
  'Suspended':   { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'Suspended' },
  // Legacy lowercase (backwards compat)
  'available':   { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Available' },
  'on-trip':     { bg: 'bg-[#FACC15]/10', text: 'text-[#FACC15]', label: 'On Trip' },
  'in-shop':     { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'In Shop' },
  'completed':   { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Completed' },
  'pending':     { bg: 'bg-[#FACC15]/10', text: 'text-[#FACC15]', label: 'Pending' },
  'active':      { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'Active' },
  'inactive':    { bg: 'bg-[#A1A1AA]/10', text: 'text-[#A1A1AA]', label: 'Inactive' },
};

const fallback = { bg: 'bg-[#A1A1AA]/10', text: 'text-[#A1A1AA]', label: 'Unknown' };

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] || fallback;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {label || config.label}
    </span>
  );
}
