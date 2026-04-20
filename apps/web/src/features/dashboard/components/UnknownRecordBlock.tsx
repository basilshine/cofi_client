import type { ReactNode } from "react";

export const UnknownRecordBlock = ({
	title,
	value,
}: {
	title?: string;
	value: Record<string, unknown> | null | undefined;
}): ReactNode => {
	if (value == null) return null;
	const keys = Object.keys(value);
	if (keys.length === 0) return null;
	return (
		<div className="space-y-2">
			{title ? (
				<p className="text-xs font-medium text-[hsl(var(--text-secondary))]">
					{title}
				</p>
			) : null}
			<dl className="space-y-1.5">
				{keys.map((k) => {
					const v = value[k];
					const display =
						v != null && typeof v === "object"
							? JSON.stringify(v)
							: String(v ?? "—");
					return (
						<div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs" key={k}>
							<dt className="font-medium text-[hsl(var(--text-secondary))]">
								{k}
							</dt>
							<dd className="min-w-0 break-words text-[hsl(var(--text-primary))]">
								{display}
							</dd>
						</div>
					);
				})}
			</dl>
		</div>
	);
};
