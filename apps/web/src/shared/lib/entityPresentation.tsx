import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { type EntityVisualKey, entityVisuals } from "./entityVisual";

export type EntityViewModel = {
	id?: string;
	visualKey: EntityVisualKey;
	label: string;
	title: ReactNode;
	subtitle?: ReactNode;
	detail?: ReactNode;
	href?: string;
	meta?: ReactNode[];
	status?: ReactNode;
	selected?: boolean;
};

type EntityIconSize = "xs" | "sm" | "md" | "lg";

const iconSizeClass: Record<EntityIconSize, string> = {
	xs: "h-5 w-5 rounded-lg",
	sm: "h-8 w-8 rounded-xl",
	md: "h-10 w-10 rounded-xl",
	lg: "h-12 w-12 rounded-2xl",
};

const iconGlyphSizeClass: Record<EntityIconSize, string> = {
	xs: "h-3 w-3",
	sm: "h-4 w-4",
	md: "h-5 w-5",
	lg: "h-6 w-6",
};

const asRenderableMeta = (meta?: ReactNode[]): ReactNode[] =>
	(meta ?? []).filter((item) => item != null && item !== "");

export const EntityIcon = ({
	className,
	size = "md",
	visualKey,
}: {
	className?: string;
	size?: EntityIconSize;
	visualKey: EntityVisualKey;
}) => {
	const visual = entityVisuals[visualKey] ?? entityVisuals.unknown;
	const Icon = visual.icon;
	return (
		<span
			className={[
				"inline-flex shrink-0 items-center justify-center border",
				iconSizeClass[size],
				visual.toneClass,
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<Icon className={iconGlyphSizeClass[size]} />
		</span>
	);
};

export const EntityMicro = ({
	entity,
}: {
	entity: Pick<EntityViewModel, "label" | "visualKey">;
}) => {
	const visual = entityVisuals[entity.visualKey] ?? entityVisuals.unknown;
	return (
		<span
			className={[
				"inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
				visual.chipClass,
			].join(" ")}
		>
			<EntityIcon size="xs" visualKey={entity.visualKey} />
			<span className="truncate">{entity.label}</span>
		</span>
	);
};

export const EntityMini = ({ entity }: { entity: EntityViewModel }) => {
	const visual = entityVisuals[entity.visualKey] ?? entityVisuals.unknown;
	const body = (
		<span
			className={[
				"flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm transition-[background-color,border-color,box-shadow,transform]",
				visual.surfaceClass,
			].join(" ")}
		>
			<EntityIcon size="sm" visualKey={entity.visualKey} />
			<span className="min-w-0 flex-1">
				<span className="flex min-w-0 items-center gap-2">
					<span className="block truncate font-semibold text-foreground">
						{entity.title}
					</span>
					{entity.status ? (
						<span
							className={[
								"shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
								visual.chipClass,
							].join(" ")}
						>
							{entity.status}
						</span>
					) : null}
				</span>
				{entity.subtitle ? (
					<span className="mt-0.5 block truncate text-xs text-muted-foreground">
						{entity.subtitle}
					</span>
				) : null}
			</span>
		</span>
	);
	if (entity.href) {
		return (
			<Link
				className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				to={entity.href}
			>
				{body}
			</Link>
		);
	}
	return body;
};

export const EntityListItem = ({ entity }: { entity: EntityViewModel }) => {
	const visual = entityVisuals[entity.visualKey] ?? entityVisuals.unknown;
	const meta = asRenderableMeta(entity.meta);
	const body = (
		<span
			className={[
				"group flex min-w-0 items-start gap-3 rounded-2xl border p-3.5 shadow-sm transition-[background-color,border-color,box-shadow,transform]",
				entity.selected ? visual.selectedSurfaceClass : visual.surfaceClass,
			].join(" ")}
		>
			<EntityIcon visualKey={entity.visualKey} />
			<span className="min-w-0 flex-1">
				<span className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="truncate text-sm font-semibold text-foreground">
						{entity.title}
					</span>
					<EntityMicro
						entity={{ label: entity.label, visualKey: entity.visualKey }}
					/>
					{entity.status ? (
						<span
							className={[
								"rounded-full border px-2 py-0.5 text-[11px] font-semibold",
								visual.chipClass,
							].join(" ")}
						>
							{entity.status}
						</span>
					) : null}
				</span>
				{entity.subtitle ? (
					<span className="mt-1 block truncate text-sm text-foreground/72">
						{entity.subtitle}
					</span>
				) : null}
				{entity.detail ? (
					<span className="mt-1 block truncate text-xs text-muted-foreground">
						{entity.detail}
					</span>
				) : null}
				{meta.length ? (
					<span className="mt-2 flex flex-wrap gap-1.5">
						{meta.slice(0, 4).map((item, index) => (
							<span
								className={[
									"rounded-full border px-2 py-0.5 text-[11px] font-medium",
									visual.chipClass,
								].join(" ")}
								key={`${String(item)}-${index}`}
							>
								{item}
							</span>
						))}
					</span>
				) : null}
			</span>
			{entity.href ? (
				<ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
			) : null}
		</span>
	);
	if (entity.href) {
		return (
			<Link className="block" to={entity.href}>
				{body}
			</Link>
		);
	}
	return body;
};

export const EntityCard = ({ entity }: { entity: EntityViewModel }) => {
	const visual = entityVisuals[entity.visualKey] ?? entityVisuals.unknown;
	const meta = asRenderableMeta(entity.meta);
	return (
		<div
			className={[
				"rounded-2xl border p-4 shadow-sm transition-[background-color,border-color,box-shadow]",
				entity.selected ? visual.selectedSurfaceClass : visual.surfaceClass,
			].join(" ")}
		>
			<div className="flex items-start gap-3">
				<EntityIcon size="lg" visualKey={entity.visualKey} />
				<div className="min-w-0 flex-1">
					<EntityMicro
						entity={{ label: entity.label, visualKey: entity.visualKey }}
					/>
					<h3 className="mt-2 truncate text-base font-semibold text-foreground">
						{entity.title}
					</h3>
					{entity.subtitle ? (
						<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
							{entity.subtitle}
						</p>
					) : null}
				</div>
			</div>
			{entity.detail ? (
				<p className="mt-3 line-clamp-3 text-sm text-foreground/76">
					{entity.detail}
				</p>
			) : null}
			{meta.length ? (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{meta.map((item, index) => (
						<span
							className={[
								"rounded-full border px-2 py-0.5 text-[11px] font-medium",
								visual.chipClass,
							].join(" ")}
							key={`${String(item)}-${index}`}
						>
							{item}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
};

export const EntityDetailHeader = ({ entity }: { entity: EntityViewModel }) => (
	<header className="flex min-w-0 items-start gap-3">
		<EntityIcon size="lg" visualKey={entity.visualKey} />
		<div className="min-w-0 flex-1">
			<EntityMicro
				entity={{ label: entity.label, visualKey: entity.visualKey }}
			/>
			<h1 className="mt-2 truncate font-display text-2xl font-bold tracking-tight text-foreground">
				{entity.title}
			</h1>
			{entity.subtitle ? (
				<p className="mt-1 text-sm text-muted-foreground">{entity.subtitle}</p>
			) : null}
		</div>
	</header>
);
