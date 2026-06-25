"use client";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ImportResult {
	offer: {
		id: string;
		title: string;
		salePrice: number;
		discountPct: number;
		aiScore?: number;
		affiliateUrl: string;
		couponCode?: string;
		couponMinValue?: number;
		telegramMessage?: string;
	};
	posted: boolean;
}

const field: React.CSSProperties = {
	width: "100%",
	padding: "10px 12px",
	borderRadius: 8,
	border: "1px solid #ddd",
	fontSize: 14,
	fontFamily: "inherit",
	boxSizing: "border-box",
	outline: "none",
};

const label: React.CSSProperties = {
	display: "block",
	fontWeight: 700,
	fontSize: 13,
	marginBottom: 6,
	color: "#333",
};

export default function AdminImportPage() {
	const [url, setUrl] = useState("");
	const [couponCode, setCouponCode] = useState("");
	const [couponDiscount, setCouponDiscount] = useState("");
	const [couponMinValue, setCouponMinValue] = useState("");
	const [couponMaxDiscount, setCouponMaxDiscount] = useState("");
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const hasCoupon = couponCode.trim() !== "";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setResult(null);
		setLoading(true);

		try {
			const body: Record<string, unknown> = { url: url.trim() };
			if (hasCoupon) {
				body.couponCode = couponCode.trim();
				if (couponDiscount.trim()) body.couponDiscount = couponDiscount.trim();
				body.couponMinValue = couponMinValue.trim() !== "" ? Number(couponMinValue) : 0;
				if (couponMaxDiscount.trim() !== "") body.couponMaxDiscount = Number(couponMaxDiscount);
			}

			const res = await fetch(`${API_URL}/api/offers/import`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Erro desconhecido");
				return;
			}

			setResult(data);
			setUrl("");
			setCouponCode("");
			setCouponDiscount("");
			setCouponMinValue("");
			setCouponMaxDiscount("");
		} catch {
			setError("Erro ao conectar com o servidor");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main style={{ maxWidth: 560, margin: "2.5rem auto", padding: "0 1rem" }}>
			<div style={{ marginBottom: "1.5rem" }}>
				<span
					style={{
						background: "#7c3aed",
						color: "#fff",
						fontSize: 11,
						fontWeight: 700,
						padding: "2px 10px",
						borderRadius: 20,
						marginBottom: 8,
						display: "inline-block",
					}}
				>
					ADMIN
				</span>
				<h1
					style={{ margin: "4px 0 4px", fontSize: "1.5rem", fontWeight: 900 }}
				>
					Importar oferta
				</h1>
				<p style={{ margin: 0, color: "#888", fontSize: 13 }}>
					Cole a URL de um produto do Mercado Livre para scraping, avaliação por
					IA e posting imediato no Telegram.
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				style={{
					background: "#fff",
					borderRadius: 14,
					padding: "1.5rem",
					border: "1px solid #e5e5e5",
					boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
					display: "flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				{/* URL */}
				<div>
					<label style={label}>URL do produto *</label>
					<input
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						required
						placeholder="https://www.mercadolivre.com.br/p/MLB..."
						style={field}
					/>
				</div>

				{/* Cupom */}
				<div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "1.25rem" }}>
					<p style={{ margin: "0 0 1rem", fontWeight: 700, fontSize: 13, color: "#555" }}>
						🎟️ Cupom{" "}
						<span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span>
					</p>
					<div style={{ marginBottom: 12 }}>
						<label style={label}>Código do cupom</label>
						<input
							type="text"
							value={couponCode}
							onChange={(e) => setCouponCode(e.target.value)}
							placeholder="#FUCHS20OFF"
							style={field}
						/>
					</div>
					{hasCoupon && (
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							<div>
								<label style={label}>Desconto do cupom</label>
								<input
									type="text"
									value={couponDiscount}
									onChange={(e) => setCouponDiscount(e.target.value)}
									placeholder='ex: "R$ 20 OFF" ou "10% OFF"'
									style={field}
								/>
							</div>
							<div style={{ display: "flex", gap: 12 }}>
								<div style={{ flex: 1 }}>
									<label style={label}>Valor mínimo (R$)</label>
									<input
										type="number"
										min={0}
										step={0.01}
										value={couponMinValue}
										onChange={(e) => setCouponMinValue(e.target.value)}
										placeholder="0 = sem mínimo"
										style={field}
									/>
								</div>
								<div style={{ flex: 1 }}>
									<label style={label}>Desconto máximo (R$)</label>
									<input
										type="number"
										min={0}
										step={0.01}
										value={couponMaxDiscount}
										onChange={(e) => setCouponMaxDiscount(e.target.value)}
										placeholder="ex: 50 (teto)"
										style={field}
									/>
								</div>
							</div>
							<p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
								Valor mínimo 0 = cupom funciona em qualquer compra. Desconto máximo = teto em R$ para cupons percentuais (ex: 10% OFF limitado a R$50).
							</p>
						</div>
					)}
				</div>

				<button
					type="submit"
					disabled={loading || !url.trim()}
					style={{
						background: loading || !url.trim() ? "#ccc" : "#FFE600",
						color: "#333",
						border: "none",
						borderRadius: 10,
						padding: "12px 20px",
						fontWeight: 800,
						fontSize: 15,
						cursor: loading || !url.trim() ? "not-allowed" : "pointer",
						fontFamily: "inherit",
						transition: "background 0.2s",
					}}
				>
					{loading ? "⏳ Processando..." : "Importar e postar 🚀"}
				</button>
			</form>

			{/* Erro */}
			{error && (
				<div
					style={{
						marginTop: "1rem",
						background: "#fff5f5",
						border: "1px solid #fed7d7",
						borderRadius: 10,
						padding: "1rem",
					}}
				>
					<p
						style={{
							margin: 0,
							color: "#c53030",
							fontWeight: 700,
							fontSize: 14,
						}}
					>
						❌ {error}
					</p>
				</div>
			)}

			{/* Resultado */}
			{result && (
				<div
					style={{
						marginTop: "1rem",
						background: result.posted ? "#f0fff4" : "#fffbe6",
						border: `1px solid ${result.posted ? "#9ae6b4" : "#fbd38d"}`,
						borderRadius: 10,
						padding: "1rem",
					}}
				>
					<p
						style={{
							margin: "0 0 8px",
							fontWeight: 800,
							fontSize: 15,
							color: result.posted ? "#276749" : "#744210",
						}}
					>
						{result.posted
							? "✅ Postado no Telegram!"
							: "⚠️ Salvo no banco, mas não postado (score IA baixo)"}
					</p>
					<p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>
						{result.offer.title}
					</p>
					<div
						style={{
							display: "flex",
							gap: 10,
							flexWrap: "wrap",
							fontSize: 13,
							color: "#555",
							marginBottom: 10,
						}}
					>
						<span>
							R$ {result.offer.salePrice.toFixed(2).replace(".", ",")}
						</span>
						{result.offer.discountPct > 0 && (
							<span>· -{result.offer.discountPct}% OFF</span>
						)}
						{result.offer.aiScore != null && (
							<span>· IA {result.offer.aiScore}/10</span>
						)}
						{result.offer.couponCode && (
							<span>· 🎟️ {result.offer.couponCode}</span>
						)}
					</div>
					<a
						href={`/oferta/${result.offer.id}`}
						style={{
							fontSize: 13,
							color: "#1a73e8",
							textDecoration: "none",
							fontWeight: 600,
						}}
					>
						Ver oferta no site →
					</a>
				</div>
			)}
		</main>
	);
}
