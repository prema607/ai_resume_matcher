import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { DashboardPage } from "@/pages/DashboardPage";
import { ResumesPage } from "@/pages/ResumesPage";
import { ResumeDetailPage } from "@/pages/ResumeDetailPage";
import { JobsPage } from "@/pages/JobsPage";
import { JobDetailPage } from "@/pages/JobDetailPage";
import { SearchPage } from "@/pages/SearchPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AppShell>
                <DashboardPage />
              </AppShell>
            }
          />
          <Route
            path="/resumes"
            element={
              <AppShell>
                <ResumesPage />
              </AppShell>
            }
          />
          <Route
            path="/resumes/:id"
            element={
              <AppShell>
                <ResumeDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/jobs"
            element={
              <AppShell>
                <JobsPage />
              </AppShell>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <AppShell>
                <JobDetailPage />
              </AppShell>
            }
          />
          <Route
            path="/search"
            element={
              <AppShell>
                <SearchPage />
              </AppShell>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
