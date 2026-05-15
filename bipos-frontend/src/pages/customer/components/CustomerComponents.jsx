import React from "react";

export function Tab({active,onClick,children}) { return <button className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active?'bg-orange-500 text-white shadow':'bg-slate-100 text-slate-600'}`} onClick={onClick}>{children}</button>; }
export function Empty({children}) { return <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">{children}</div>; }
