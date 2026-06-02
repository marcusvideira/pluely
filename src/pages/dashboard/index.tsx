import { PageLayout } from "@/layouts";
import { useMenuItems } from "@/hooks";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components";

const Dashboard = () => {
  const { menu } = useMenuItems();
  const navigate = useNavigate();

  const shortcuts = menu.filter((item) => item.href !== "/dashboard");

  return (
    <PageLayout
      title="Welcome to Pluely"
      description="A fully open-source, privacy-first AI assistant. Bring your own API keys — every feature is free."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map((item) => (
          <Card
            key={item.href}
            className="p-4 border cursor-pointer hover:border-primary/50 transition-all flex items-center gap-3"
            onClick={() => navigate(item.href)}
          >
            <item.icon className="size-5 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
};

export default Dashboard;
