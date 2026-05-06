import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AttentionItem = {
	key: string;
	label: string;
	detail: string;
	icon: ReactNode;
	to: string;
	tone: "warn" | "primary" | "muted";
};

type RailAttentionBlockProps = {
	items: AttentionItem[];
	linkState?: unknown;
};

export const RailAttentionBlock = ({
	items,
	linkState,
}: RailAttentionBlockProps) => {
	return (
		<section aria-labelledby="rail-attention" className="space-y-3">
			<h4 className="eyebrow" id="rail-attention">
				Attention
			</h4>
			<div className="rounded-2xl border border-border/60 bg-card p-4 soft-shadow inner-glow">
				{items.length === 0 ? (
					<p className="px-1 py-2 text-sm text-muted-foreground">
						All clear for now.
					</p>
				) : (
					<ul className="space-y-2">
						{items.map((item, index) => (
							<li key={item.key}>
								<Link
									className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
										index === 0
											? "border border-[rgba(142,159,136,0.32)] bg-[rgba(142,159,136,0.09)] shadow-[0_12px_20px_-18px_rgba(31,37,35,0.5)] hover:bg-[rgba(142,159,136,0.14)]"
											: "hover:bg-background/60"
									}`}
									state={linkState}
									to={item.to}
								>
									<span
										className={[
											"mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
											item.tone === "warn"
												? "border-[rgba(189,143,64,0.34)] bg-[rgba(189,143,64,0.16)] text-[rgba(120,82,27,0.9)]"
												: item.tone === "primary"
													? "border-[rgba(142,159,136,0.35)] bg-[rgba(142,159,136,0.14)] text-[#4E5C51]"
													: "border-border/70 bg-muted/45 text-muted-foreground",
										].join(" ")}
									>
										{item.icon}
									</span>
									<span className="min-w-0">
										<span
											className={`block ${
												index === 0
													? "text-[15px] font-semibold text-foreground"
													: "text-sm font-medium text-foreground"
											}`}
										>
											{item.label}
										</span>
										<span className="mt-0.5 block text-xs text-muted-foreground">
											{item.detail}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
};
