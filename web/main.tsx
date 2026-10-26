import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/globals.css";
import AppShell from "./routes/app-shell";
import ActivityPage from "./routes/activity";
import CalendarPage from "./routes/calendar";
import CampaignsPage from "./routes/campaigns";
import NewCampaignPage from "./routes/campaigns/new";
import ClientsPage from "./routes/clients";
import ClientDetailPage from "./routes/clients/detail";
import ContentPage from "./routes/content";
import DashboardPage from "./routes/dashboard";
import FilesPage from "./routes/files";
import ForgotPasswordPage from "./routes/forgot-password";
import GoalsPage from "./routes/goals";
import InvoicesPage from "./routes/invoices";
import NewInvoicePage from "./routes/invoices/new";
import LeadsPage from "./routes/leads";
import LoginPage from "./routes/login";
import NotificationsPage from "./routes/notifications";
import PortalPage from "./routes/portal";
import ProjectsPage from "./routes/projects";
import ReportsPage from "./routes/reports";
import ResetPasswordPage from "./routes/reset-password";
import SettingsPage from "./routes/settings";
import TasksPage from "./routes/tasks";
import TeamPage from "./routes/team";
import TeamMemberPage from "./routes/team/member";
import TimePage from "./routes/time";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/portal", element: <PortalPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "leads", element: <LeadsPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:id", element: <ClientDetailPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "time", element: <TimePage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "invoices/new", element: <NewInvoicePage /> },
      { path: "campaigns", element: <CampaignsPage /> },
      { path: "campaigns/new", element: <NewCampaignPage /> },
      { path: "content", element: <ContentPage /> },
      { path: "goals", element: <GoalsPage /> },
      { path: "team", element: <TeamPage /> },
      { path: "team/:id", element: <TeamMemberPage /> },
      { path: "files", element: <FilesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
);
