/**
 * Design QA only: logo system on light/dark surfaces and small sizes.
 * Import on a dev/design route or paste temporarily — not for production nav.
 */
import { CeitsAppIcon } from "./CeitsAppIcon";
import { CeitsFaviconMark } from "./CeitsFaviconMark";
import { CeitsLogoHorizontal } from "./CeitsLogoHorizontal";
import { CeitsLogoMark } from "./CeitsLogoMark";
import { CeitsLogoStacked } from "./CeitsLogoStacked";

const sizes = [16, 24, 32, 48] as const;

export const CeitsLogoPreview = () => {
	return (
		<div className="space-y-10 p-8 font-editorial">
			<header>
				<h1 className="text-lg font-semibold text-foreground">
					Ceits logo system (preview)
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Dark reference mood is primary; light surfaces shown for contrast.
				</p>
			</header>

			<section className="space-y-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Dark surface
				</h2>
				<div
					className="ceits-logo-variant-dark rounded-2xl p-8"
					style={{ background: "var(--ceits-brand-navy)" }}
				>
					<div className="flex flex-wrap items-end gap-8">
						<CeitsLogoHorizontal title="Ceits" variant="dark" />
						<CeitsLogoStacked title="Ceits" variant="dark" />
						<CeitsLogoMark title="Ceits mark" variant="dark" />
						<CeitsAppIcon title="Ceits app" variant="dark" />
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Light surface
				</h2>
				<div className="ceits-logo-variant-light rounded-2xl border border-border bg-[var(--ceits-brand-ivory)] p-8">
					<div className="flex flex-wrap items-end gap-8">
						<CeitsLogoHorizontal title="Ceits" variant="light" />
						<CeitsLogoStacked title="Ceits" variant="light" />
						<CeitsLogoMark title="Ceits mark" variant="light" />
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Mark at small sizes
				</h2>
				<div className="flex flex-wrap items-end gap-6 rounded-xl border border-border bg-card p-6">
					{sizes.map((s) => (
						<div className="text-center" key={s}>
							<CeitsLogoMark size={s} title={`${s}px`} variant="light" />
							<p className="mt-2 text-[10px] text-muted-foreground">{s}px</p>
						</div>
					))}
				</div>
				<div className="flex flex-wrap items-end gap-6 rounded-xl border border-border bg-[var(--ceits-brand-navy)] p-6 ceits-logo-variant-dark">
					{sizes.map((s) => (
						<div className="text-center" key={`d-${s}`}>
							<CeitsLogoMark size={s} title={`${s}px`} variant="dark" />
							<p className="mt-2 text-[10px] text-[var(--ceits-brand-ivory)]/80">
								{s}px
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Favicon density
				</h2>
				<div className="flex flex-wrap items-end gap-6 rounded-xl border border-border bg-card p-6">
					{[16, 24].map((s) => (
						<div className="text-center" key={s}>
							<CeitsFaviconMark
								size={s}
								title={`Favicon ${s}`}
								variant="light"
							/>
							<p className="mt-2 text-[10px] text-muted-foreground">
								favicon {s}px
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Clear space (illustrative)
				</h2>
				<p className="text-sm text-muted-foreground">
					Padding around the mark equals the inner C height at the same scale
					(see brand doc).
				</p>
				<div className="inline-block rounded-xl border border-dashed border-[var(--ceits-logo-accent)]/50 bg-muted/30 p-[1.5rem] ceits-logo-variant-light">
					<CeitsLogoMark size={48} variant="light" />
				</div>
			</section>
		</div>
	);
};
