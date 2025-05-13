import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { ChartLineUp, ChartPie, Wallet } from "@phosphor-icons/react";

export const Home = () => {
	const features = [
		{
			title: "Track Expenses",
			description: "Easily record and categorize your daily expenses",
			icon: Wallet,
		},
		{
			title: "Analytics",
			description: "Get insights into your spending patterns and trends",
			icon: ChartLineUp,
		},
		{
			title: "Budget Planning",
			description: "Plan and manage your monthly budget effectively",
			icon: ChartPie,
		},
	];

	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">
					Welcome to Cofilance
				</h1>
				<p className="text-muted-foreground">
					Your personal financial management assistant. Track expenses, analyze
					spending patterns, and manage your budget effectively.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				{features.map((feature) => {
					const Icon = feature.icon;
					return (
						<Card
							key={feature.title}
							className="hover:bg-accent/50 transition-colors"
						>
							<CardHeader>
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<Icon className="h-6 w-6 text-primary" />
								</div>
							</CardHeader>
							<CardContent>
								<CardTitle className="mb-2">{feature.title}</CardTitle>
								<p className="text-sm text-muted-foreground">
									{feature.description}
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
};
