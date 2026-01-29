import React from 'react';

const NotificationBadge = ({ count }) => {
  if (!count || count <= 0) return null;
  const display = count > 99 ? '99+' : String(count);
  return (
    <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white">
      {display}
    </span>
  );
};

export default NotificationBadge;
