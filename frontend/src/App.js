import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fields from './pages/Fields';
import FieldDetail from './pages/FieldDetail';
import FieldForm from './pages/FieldForm';
import Agents from './pages/Agents';
import './styles.css';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="fields" element={<Fields />} />
                        <Route path="fields/new" element={<FieldForm />} />
                        <Route path="fields/:id" element={<FieldDetail />} />
                        <Route path="fields/:id/edit" element={<FieldForm />} />
                        <Route path="agents" element={<Agents />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
