import { getOffers } from "@/lib/api";
import OfferCard from "@/components/OfferCard";

export const metadata = {
	title: "Fox Ofertas — Promoções e Cupons do Mercado Livre",
	description:
		"As melhores promoções e cupons do Mercado Livre, selecionadas por IA.",
};

const TABS = [
	{ label: "🕐 Novos", value: "recent" },
	{ label: "🔥 Quentes", value: "votes" },
	{ label: "% Descontos", value: "discount" },
] as const;

const PAGE_SIZE = 20;

interface SearchParams {
	ordenar?: string;
	pagina?: string;
}

export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>;
}) {
	const params = await searchParams;
	const page = Number(params.pagina) || 1;
	const sort =
		(params.ordenar as "recent" | "votes" | "discount") || "recent";

	const { offers, total } = await getOffers({ limit: PAGE_SIZE, page, sort });
	const totalPages = Math.ceil(total / PAGE_SIZE);

	return (
		<main
			suppressHydrationWarning
			style={{ maxWidth: 860, margin: "0 auto", padding: "1.5rem 1rem" }}
		>
			{/* Tabs de ordenação */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 4,
					marginBottom: "1.25rem",
					borderBottom: "2px solid #e5e5e5",
					paddingBottom: "0.75rem",
					flexWrap: "wrap",
				}}
			>
				{TABS.map((tab) => (
					<a
						key={tab.value}
						href={`?ordenar=${tab.value}`}
						style={{
							textDecoration: "none",
							fontWeight: 600,
							fontSize: 14,
							padding: "6px 14px",
							borderRadius: 20,
							background: sort === tab.value ? "#FFE600" : "transparent",
							color: sort === tab.value ? "#333" : "#666",
							transition: "background 0.15s",
						}}
					>
						{tab.label}
					</a>
				))}
				<span style={{ marginLeft: "auto", color: "#999", fontSize: 13 }}>
					{total} ofertas
				</span>
			</div>

			{/* Feed */}
			{offers.length === 0 ? (
				<div
					style={{ textAlign: "center", padding: "4rem 1rem", color: "#888" }}
				>
					<p style={{ fontSize: 48, margin: 0 }}>🛍️</p>
					<p>Nenhuma oferta disponível ainda.</p>
				</div>
			) : (
				<div
					style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
				>
					{offers.map((offer) => (
						<OfferCard key={offer.id} offer={offer} />
					))}
				</div>
			)}

			{/* Paginação */}
			{totalPages > 1 && (
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						gap: "0.375rem",
						marginTop: "2rem",
						flexWrap: "wrap",
					}}
				>
					{page > 1 && (
						<a href={`?ordenar=${sort}&pagina=${page - 1}`} style={pageBtn}>
							← Anterior
						</a>
					)}
					{buildPageNumbers(page, totalPages).map((p, i) =>
						p === "..." ? (
							<span
								key={`ellipsis-${i}`}
								style={{ ...pageBtn, cursor: "default", color: "#999" }}
							>
								…
							</span>
						) : (
							<a
								key={p}
								href={`?ordenar=${sort}&pagina=${p}`}
								style={{ ...pageBtn, ...(p === page ? activePage : {}) }}
							>
								{p}
							</a>
						),
					)}
					{page < totalPages && (
						<a href={`?ordenar=${sort}&pagina=${page + 1}`} style={pageBtn}>
							Próxima →
						</a>
					)}
				</div>
			)}
		</main>
	);
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
	if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
	const pages: (number | "...")[] = [1];
	if (current > 3) pages.push("...");
	for (
		let p = Math.max(2, current - 1);
		p <= Math.min(total - 1, current + 1);
		p++
	)
		pages.push(p);
	if (current < total - 2) pages.push("...");
	pages.push(total);
	return pages;
}

const pageBtn: React.CSSProperties = {
	textDecoration: "none",
	color: "#555",
	background: "#fff",
	border: "1px solid #ddd",
	padding: "7px 14px",
	borderRadius: 8,
	fontWeight: 600,
	fontSize: 13,
};

const activePage: React.CSSProperties = {
	background: "#FFE600",
	border: "1px solid #e6c800",
	color: "#333",
};
