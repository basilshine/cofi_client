import { CalendarBlank, CaretRight, X } from "@phosphor-icons/react";
import { type ReactNode, useId } from "react";
import { type UILanguage, uiText } from "./mini-i18n";
import { mobileDatePresentation } from "./mobile-date";

export const MobileDateField = ({
	ariaDescribedBy,
	ariaInvalid = false,
	ariaLabel,
	children,
	className = "",
	disabled = false,
	label,
	language,
	max,
	min,
	required = false,
	value,
	onChange,
}: {
	ariaDescribedBy?: string;
	ariaInvalid?: boolean;
	ariaLabel: string;
	children?: ReactNode;
	className?: string;
	disabled?: boolean;
	label: ReactNode;
	language: UILanguage;
	max?: string;
	min?: string;
	required?: boolean;
	value: string;
	onChange: (value: string) => void;
}) => {
	const inputID = useId();
	const presentation = mobileDatePresentation(value, language);
	const canClear = Boolean(value) && !required && !disabled;

	return (
		<div
			className={`mini-mobile-date-field${className ? ` ${className}` : ""}`}
		>
			<label className="mini-mobile-date-label" htmlFor={inputID}>
				{label}
			</label>
			<div
				className={`mini-mobile-date-control${canClear ? " has-clear" : ""}${ariaInvalid ? " is-invalid" : ""}`}
			>
				<span className="mini-mobile-date-icon" aria-hidden="true">
					<CalendarBlank size={21} weight="duotone" />
				</span>
				<span className="mini-mobile-date-copy" aria-hidden="true">
					<strong>{presentation.primary}</strong>
					<small>{presentation.secondary}</small>
				</span>
				{canClear ? (
					<button
						className="mini-mobile-date-clear"
						type="button"
						aria-label={uiText(language, "clearDate")}
						title={uiText(language, "clearDate")}
						onClick={() => onChange("")}
					>
						<X size={17} weight="bold" />
					</button>
				) : (
					<CaretRight
						className="mini-mobile-date-caret"
						size={18}
						weight="bold"
						aria-hidden="true"
					/>
				)}
				<input
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					aria-label={ariaLabel}
					disabled={disabled}
					id={inputID}
					max={max}
					min={min}
					required={required}
					type="date"
					value={value}
					onClick={(event) => {
						try {
							event.currentTarget.showPicker?.();
						} catch {
							// The native input remains usable when a browser blocks showPicker.
						}
					}}
					onChange={(event) => onChange(event.target.value)}
				/>
			</div>
			{children}
		</div>
	);
};
