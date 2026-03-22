import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { loginProvisional } from '../utils/supabase';

/**
 * InductionLogin - Simple login page for provisional members
 * 
 * This page ONLY handles login. After successful login, it redirects to
 * /team-login where TeamLogin.tsx handles ALL dashboard functionality.
 * 
 * DO NOT add dashboard/task UI code here - it will cause duplication issues
 * where changes in TeamLogin.tsx don't reflect because this file has its own copy.
 */
const InductionLoginPage = () => {
    const navigate = useNavigate();
    const [memberId, setMemberId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setError('');
        if (!memberId || !password) {
            setError('Please enter member ID and password');
            return;
        }

        setLoading(true);
        try {
            const mem = await loginProvisional(memberId.trim(), password);
            if (!mem) {
                setError('Invalid credentials or not eligible for induction login');
                setLoading(false);
                return;
            }

            // Store session data so TeamLogin.tsx can pick it up
            try {
                sessionStorage.setItem('udaanMemberId', mem.member_id || '');
                sessionStorage.setItem('udaanMemberData', JSON.stringify(mem));
                sessionStorage.setItem('udaanIsProvisional', 'true');
            } catch (err) {
                console.error('Failed to store session:', err);
            }

            // Redirect to induction portal (separate URL from regular team login)
            navigate('/induction-portal');
        } catch (err) {
            console.error('Induction login error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-nation-black p-6">
            <div className="max-w-md w-full bg-nation-panel/40 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded bg-nation-secondary/20 flex items-center justify-center">
                        <Lock className="text-nation-secondary" />
                    </div>
                    <div>
                        <h1 className="text-white font-display text-lg">Induction Login</h1>
                        <p className="text-nation-text text-sm">Use the credentials emailed to you after selection.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-3">
                    <input
                        value={memberId}
                        onChange={e => setMemberId(e.target.value)}
                        placeholder="Member ID (e.g. UDAAN-1001)"
                        className="w-full px-3 py-2 rounded bg-black/40 text-white"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Temporary password"
                        className="w-full px-3 py-2 rounded bg-black/40 text-white"
                    />

                    {error && <div className="text-red-400 text-sm">{error}</div>}

                    <div className="flex gap-2">
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-nation-secondary text-black rounded-md">
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                        <button type="button" onClick={() => navigate('/')} className="px-4 py-2 border border-white/10 rounded-md text-nation-text">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InductionLoginPage;
