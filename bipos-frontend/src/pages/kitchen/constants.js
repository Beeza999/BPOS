export const stations = [
  { id: "all", label: "ທັງໝົດ" },
  { id: "HOT", label: "ຄົວຮ້ອນ" },
  { id: "BAR", label: "ບານ້ຳ" },
  { id: "DESSERT", label: "ຂອງຫວານ" },
];

export const statuses = [
  { id: "all", label: "ທຸກສະຖານະ" },
  { id: "NEW", label: "ອໍເດີໃໝ່" },
  { id: "ACCEPTED", label: "ຮັບແລ້ວ" },
  { id: "COOKING", label: "ກຳລັງເຮັດ" },
  { id: "READY", label: "ພ້ອມເສີບ" },
];

export const statusClass = {
  NEW: "bg-red-50 text-red-600 border-red-100",
  ACCEPTED: "bg-amber-50 text-amber-600 border-amber-100",
  COOKING: "bg-blue-50 text-blue-600 border-blue-100",
  READY: "bg-emerald-50 text-emerald-600 border-emerald-100",
};
