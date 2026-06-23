import { Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  Flame,
  Home,
  Menu,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Star,
  Utensils,
} from "lucide-react";
import { CartButton } from "./CartSheet";
import { ChangeServiceModeButton } from "./ChangeServiceModeButton";
import { getMenuData } from "@/lib/menu.functions";
import { formatBRL, parsePrice } from "@/lib/cart-store";
import { getSavedOrders } from "@/lib/order-history";

const ProductCustomization = lazy(() =>
  import("./ProductCustomization").then((m) => ({ default: m.ProductCustomization })),
);

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  image_url?: string | null;
  category_id?: string | null;
  controlar_estoque?: boolean;
  quantidade_estoque?: number | null;
  permitir_observacao?: boolean;
  placeholder_observacao?: string | null;
};

type Category = {
  id: string;
  name: string;
  tipo?: string | null;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const categoryRank = (name: string) => {
  const label = normalize(name);
  if (label.includes("mais pedido")) return 0;
  if (label.includes("burger") || label.includes("hamburg")) return 1;
  if (label.includes("acompanh")) return 2;
  if (label.includes("bebida")) return 3;
  if (label.includes("hot dog")) return 4;
  return 5;
};

const categoryIcon = (name: string) => {
  const label = normalize(name);
  if (label.includes("mais pedido")) return Star;
  if (label.includes("bebida")) return Flame;
  if (label.includes("hot dog")) return Utensils;
  if (label.includes("acompanh")) return Star;
  return Flame;
};

const toProduct = (item: MenuItem) => ({
  id: item.id,
  name: item.name,
  price: parsePrice(item.price),
  desc: item.description || "",
  img: item.image_url || "",
  permitir_observacao: item.permitir_observacao,
  placeholder_observacao: item.placeholder_observacao,
});

export function DarkPremiumMenu({ showBack = false }: { showBack?: boolean }) {
  const { data } = useSuspenseQuery({
    queryKey: ["menuData"],
    queryFn: () => getMenuData(),
  });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const savedOrders = typeof window !== "undefined" ? getSavedOrders() : [];
  const lastOrder = savedOrders[0];

  const categories = useMemo(() => {
    return (data.categories as Category[])
      .filter((cat) => (cat.tipo ?? "produto") === "produto")
      .sort((a, b) => categoryRank(a.name) - categoryRank(b.name) || a.name.localeCompare(b.name));
  }, [data.categories]);

  const currentCategoryId = activeCategoryId || categories[0]?.id || null;
  const search = normalize(query);

  const visibleItems = useMemo(() => {
    const list = data.items as MenuItem[];
    if (!search) return list;
    return list.filter((item) =>
      normalize(`${item.name} ${item.description ?? ""}`).includes(search),
    );
  }, [data.items, search]);

  const itemsByCategory = useMemo(() => {
    return categories
      .map((category) => ({
        category,
        items: visibleItems.filter((item) => item.category_id === category.id),
      }))
      .filter((section) => section.items.length > 0);
  }, [categories, visibleItems]);

  const heroProduct =
    visibleItems.find((item) => item.category_id === currentCategoryId && item.image_url) ||
    visibleItems.find((item) => item.image_url) ||
    visibleItems[0];

  const openProduct = (item: MenuItem) => {
    const outOfStock = item.controlar_estoque === true && Number(item.quantidade_estoque ?? 0) <= 0;
    if (!outOfStock) setSelectedProduct(toProduct(item));
  };

  const scrollToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    window.setTimeout(() => {
      document.getElementById(`menu-category-${categoryId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 40);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {showBack && (
              <Link to="/" aria-label="Voltar" className="-ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:text-primary">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}
            <Link to="/" className="flex items-center gap-2 min-w-0" aria-label="CISSABURGUER">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_var(--gold-glow)]">
                <Flame className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-foreground">
                CISSABURGUER
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ChangeServiceModeButton className="hidden sm:inline-flex" />
            <button aria-label="Abrir menu" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Menu className="h-4 w-4" />
            </button>
            <CartButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-4">
        <label className="relative block" aria-label="Buscar no cardápio">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar no cardápio"
            className="h-11 w-full rounded-full border border-transparent bg-card px-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </label>

        {heroProduct && (
          <section className="relative mt-5 overflow-hidden rounded-[1.35rem] border border-border bg-card shadow-2xl shadow-black/30">
            <div className="aspect-[16/9] min-h-[210px] md:min-h-[360px]">
              {heroProduct.image_url ? (
                <img
                  src={heroProduct.image_url}
                  alt={heroProduct.name}
                  className="h-full w-full object-cover"
                  width="1200"
                  height="675"
                  {...({ fetchPriority: "high" } as any)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-secondary">
                  <Flame className="h-12 w-12 text-primary" />
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
            <button
              onClick={() => openProduct(heroProduct)}
              className="absolute inset-x-0 bottom-0 p-5 text-left md:p-7"
            >
              <p className="text-3xl font-black leading-none text-foreground md:text-5xl">{heroProduct.name}</p>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground md:text-sm">
                {heroProduct.description || "Escolha seus adicionais e finalize seu pedido."}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground">
                {formatBRL(parsePrice(heroProduct.price))}
              </span>
            </button>
          </section>
        )}

        <nav className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 scrollbar-hide" aria-label="Categorias do cardápio">
          <div className="flex w-max gap-2">
            {categories.map((category) => {
              const active = currentCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => scrollToCategory(category.id)}
                  className={`h-9 whitespace-nowrap rounded-full px-4 text-[11px] font-bold transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_0_22px_var(--gold-glow)]"
                      : "border border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-4 space-y-7">
          {itemsByCategory.map(({ category, items }) => {
            const Icon = categoryIcon(category.name);
            return (
              <section key={category.id} id={`menu-category-${category.id}`} className="scroll-mt-28">
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-black text-foreground">{category.name}</h2>
                </div>
                <div className="divide-y divide-border/70">
                  {items.map((item) => {
                    const outOfStock = item.controlar_estoque === true && Number(item.quantidade_estoque ?? 0) <= 0;
                    return (
                      <article key={item.id} className={`flex min-h-32 gap-3 py-4 ${outOfStock ? "opacity-60" : ""}`}>
                        <button
                          onClick={() => openProduct(item)}
                          disabled={outOfStock}
                          className="flex flex-1 flex-col items-start justify-between text-left min-w-0"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-black leading-tight text-foreground">{item.name}</span>
                            <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                              {item.description || "Produto artesanal CISSABURGUER."}
                            </span>
                          </span>
                          <span className="mt-3 text-xs font-black text-primary">
                            {outOfStock ? "Esgotado" : formatBRL(parsePrice(item.price))}
                          </span>
                        </button>
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-card md:h-36 md:w-36">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                              width="180"
                              height="180"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-secondary text-primary">
                              <Flame className="h-7 w-7" />
                            </div>
                          )}
                          <button
                            onClick={() => openProduct(item)}
                            disabled={outOfStock}
                            aria-label={`Adicionar ${item.name}`}
                            className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {itemsByCategory.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm font-bold text-foreground">Nenhum produto encontrado</p>
              <p className="mt-1 text-xs text-muted-foreground">Tente buscar por outro nome ou categoria.</p>
            </div>
          )}
        </div>

        <section className="mt-10 rounded-2xl border border-border bg-card px-6 py-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-black text-foreground">Aviso Importante</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Siga nosso Instagram <span className="font-bold text-primary">@cissaburger</span> para conferir novidades, combos e avisos especiais.
          </p>
          <a
            href="https://www.instagram.com/cissaburger"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-xs font-black text-primary-foreground shadow-[0_0_24px_var(--gold-glow)] transition-transform hover:scale-105"
          >
            Seguir Agora
          </a>
        </section>
      </main>

      <nav className="fixed bottom-4 left-1/2 z-40 grid w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 rounded-2xl border border-border bg-card/95 px-4 py-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <Link to="/" className="flex flex-col items-center gap-1 text-primary">
          <Home className="h-4 w-4" />
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </Link>
        <button
          onClick={() => {
            if (lastOrder) navigate({ to: "/pedido/$id", params: { id: lastOrder.id } });
            else setMoreOpen(true);
          }}
          className="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Receipt className="h-4 w-4" />
          <span className="text-[9px] font-black uppercase tracking-widest">Histórico</span>
        </button>
        <CartButton className="mx-auto flex flex-col items-center gap-1 border-0 bg-transparent p-0 text-muted-foreground hover:text-primary" label="Pedido" />
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={() => setMoreOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-black text-foreground">Nenhum pedido ativo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Faça um pedido para acompanhar o preparo por aqui.</p>
            <button onClick={() => setMoreOpen(false)} className="mt-5 h-11 w-full rounded-full bg-primary text-sm font-black text-primary-foreground">
              Continuar no cardápio
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <ProductCustomization product={selectedProduct} isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} />
      </Suspense>
    </div>
  );
}