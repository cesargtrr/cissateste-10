import { memo } from "react";
import { Utensils, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const TableGridItem = memo(({ num, info, isActive, onClick }: any) => {
  const occupied = !!info;
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-2xl border-2 p-3 flex flex-col items-center justify-center transition-all ${
        isActive
          ? "border-[#FF7A00] bg-[#FF7A00]/10"
          : occupied
            ? "bg-emerald-500/15 border-emerald-500 hover:bg-emerald-500/25"
            : "bg-[#1a1a1a] border-[#3A2414] hover:border-[#D4A15A]/50"
      }`}
    >
      <Utensils className={`w-5 h-5 mb-1 ${occupied ? "text-emerald-400" : "text-[#5a5a5a]"}`} />
      <span className={`text-2xl font-black ${occupied ? "text-emerald-300" : "text-[#A3A3A3]"}`}>
        {num}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[#A3A3A3]">Mesa</span>
      {occupied && (
        <div className="mt-1 text-center">
          <p className="text-[10px] text-emerald-300/80">{info.orders_count} pedido(s)</p>
          <p className="text-xs font-bold text-emerald-200">{formatBRL(info.total)}</p>
        </div>
      )}
    </button>
  );
});

export const TableQuickTab = memo(({ num, info, isActive, onClick }: any) => {
  const occupied = !!info;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all shrink-0 ${
        isActive
          ? "border-[#FF7A00] bg-[#FF7A00]/15 text-[#FF7A00]"
          : occupied
            ? "border-emerald-600/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            : "border-[#3A2414] bg-[#1a1a1a] text-[#A3A3A3] hover:border-[#D4A15A]/50"
      }`}
    >
      Mesa {num}
      {occupied && (
        <span className="ml-2 text-[10px] opacity-80">{formatBRL(info.total)}</span>
      )}
    </button>
  );
});

export const ComandaItemRow = memo(({ item, idx, checked, onCheckChange, onRemove, isRemoving }: any) => {
  const unit = item.line_total / Math.max(item.quantity, 1);
  return (
    <tr className={`border-b border-[#1f1410] hover:bg-[#121212] transition-colors ${checked ? "bg-[#FF7A00]/5" : ""}`}>
      <td className="px-3 py-2 align-top">
        <Checkbox checked={checked} onCheckedChange={onCheckChange} />
      </td>
      <td className="px-2 py-2 text-[#A3A3A3] align-top">{idx + 1}</td>
      <td className="px-2 py-2 align-top">
        <p className="font-bold text-[#E7D3B1]">{item.name}</p>
        {Array.isArray(item.extras) && item.extras.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {item.extras.map((ex: any, i: number) => (
              <p key={i} className="text-[10px] text-[#A3A3A3]">
                + {ex.qty}x {ex.name}
              </p>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="text-[10px] text-[#D4A15A] italic mt-1">Obs: {item.notes}</p>
        )}
      </td>
      <td className="px-2 py-2 text-center align-top text-[#FF7A00] font-bold">
        {item.quantity}
      </td>
      <td className="px-2 py-2 text-right align-top text-[#E7D3B1]">
        {formatBRL(unit)}
      </td>
      <td className="px-2 py-2 text-right align-top font-bold text-[#E7D3B1]">
        {formatBRL(item.line_total)}
      </td>
      <td className="px-2 py-2 align-top">
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="text-red-500 hover:text-red-400 disabled:opacity-50"
          aria-label="Remover item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
});
