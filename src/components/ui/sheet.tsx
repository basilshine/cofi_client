import { cn } from "@utils/cn";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { Button } from "./button";

const sheetVariants = cva(
	"fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
	{
		variants: {
			side: {
				top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
				bottom:
					"inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
				left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
				right:
					"inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
			},
		},
		defaultVariants: {
			side: "right",
		},
	},
);

interface SheetContextValue {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

interface SheetProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

const Sheet = ({ children, open = false, onOpenChange }: SheetProps) => {
	const [internalOpen, setInternalOpen] = React.useState(open);

	const isOpen = onOpenChange ? open : internalOpen;
	const setOpen = onOpenChange || setInternalOpen;

	React.useEffect(() => {
		if (open !== undefined) {
			setInternalOpen(open);
		}
	}, [open]);

	return (
		<SheetContext.Provider value={{ open: isOpen, onOpenChange: setOpen }}>
			{children}
		</SheetContext.Provider>
	);
};

const SheetTrigger = React.forwardRef<
	React.ElementRef<typeof Button>,
	React.ComponentPropsWithoutRef<typeof Button>
>(({ className, children, ...props }, ref) => {
	const context = React.useContext(SheetContext);
	if (!context) throw new Error("SheetTrigger must be used within Sheet");

	return (
		<Button
			ref={ref}
			className={className}
			onClick={() => context.onOpenChange(true)}
			{...props}
		>
			{children}
		</Button>
	);
});
SheetTrigger.displayName = "SheetTrigger";

interface SheetContentProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof sheetVariants> {
	children?: React.ReactNode;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
	({ side = "right", className, children, ...props }, ref) => {
		const context = React.useContext(SheetContext);
		if (!context) throw new Error("SheetContent must be used within Sheet");

		// Handle escape key
		React.useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.key === "Escape" && context.open) {
					context.onOpenChange(false);
				}
			};

			if (context.open) {
				document.addEventListener("keydown", handleKeyDown);
				return () => document.removeEventListener("keydown", handleKeyDown);
			}
		}, [context]);

		if (!context.open) return null;

		const handleBackdropClick = () => {
			context.onOpenChange(false);
		};

		const handleBackdropKeyDown = (event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				context.onOpenChange(false);
			}
		};

		return (
			<>
				{/* Backdrop */}
				<div
					className="fixed inset-0 z-40 bg-black/50"
					onClick={handleBackdropClick}
					onKeyDown={handleBackdropKeyDown}
					role="button"
					tabIndex={0}
					aria-label="Close menu"
				/>
				{/* Sheet */}
				<div
					ref={ref}
					data-state={context.open ? "open" : "closed"}
					className={cn(sheetVariants({ side }), className)}
					{...props}
				>
					{children}
				</div>
			</>
		);
	},
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col space-y-2 text-center sm:text-left",
			className,
		)}
		{...props}
	/>
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn("text-lg font-semibold text-foreground", className)}
		{...props}
	/>
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-sm text-muted-foreground", className)}
		{...props}
	/>
));
SheetDescription.displayName = "SheetDescription";

export {
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
};
