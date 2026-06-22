import { useState } from "react";
import { Repeat } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setServiceMode, useServiceMode, describeMode } from "@/lib/service-mode-store";
import { clearCart, useCart } from "@/lib/cart-store";

export const ChangeServiceModeButton = ({ className = "" }: { className?: string }) => {
  const mode = useServiceMode();
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  if (!mode) return null;

  const handleChange = () => {
    if (count > 0) {
      setOpen(true);
    } else {
      setServiceMode(null);
    }
  };

  const confirm = () => {
    clearCart();
    setServiceMode(null);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={handleChange}
        title="Alterar forma de pedido"
        className={`inline-flex items-center gap-1.5 text-[10px] md:text-xs font-semibold uppercase tracking-wider text-[#D4A15A] hover:text-[#FF7A00] bg-[#1a1a1a] border border-[#D4A15A]/25 hover:border-[#FF7A00] rounded-full px-3 py-1.5 transition-colors ${className}`}
      >
        <Repeat className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ALTERAR PEDIDO</span>
        <span className="hidden md:inline text-[#A3A3A3] normal-case tracking-normal font-normal">
          · {describeMode(mode)}
        </span>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-[#121212] border-[#3A2414] text-[#E7D3B1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#E7D3B1]">Alterar forma de pedido?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              Ao alterar a forma de pedido, seu carrinho será limpo. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border-[#3A2414] text-[#E7D3B1] hover:bg-[#3A2414] hover:text-[#E7D3B1]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              className="bg-[#FF7A00] hover:bg-[#D97706] text-[#121212] font-bold"
            >
              Sim, alterar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};