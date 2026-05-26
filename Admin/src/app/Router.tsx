import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { useAuth } from "../context/AuthContext";
import { LoginPage } from "../modules/auth/pages/Login";
import { DashboardPage } from "../modules/dashboard/pages/Dashboard";
import { OficinasPage } from "../modules/oficinas/pages/Oficinas";
import { OficinaDetalhePage } from "../modules/oficinas/pages/OficinaDetalhe";
import { AdminsPage } from "../modules/admins/pages/Admins";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="oficinas" element={<OficinasPage />} />
          <Route path="oficinas/:id" element={<OficinaDetalhePage />} />
          <Route path="admins" element={<AdminsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
