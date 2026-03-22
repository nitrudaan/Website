/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Rocket, Plane, Gamepad2, User, Mail, Phone, GraduationCap, Building2, Send, CheckCircle, Plus, X, Users, Trophy, AlertCircle } from 'lucide-react';
import { registerForEvent } from '../utils/supabase';

const HudCorner = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const baseClasses = "absolute w-4 h-4 border-nation-secondary/50";
    const positions = {
        tl: "top-0 left-0 border-t border-l",
        tr: "top-0 right-0 border-t border-r",
        bl: "bottom-0 left-0 border-b border-l",
        br: "bottom-0 right-0 border-b border-r"
    };
    return <div className={`${baseClasses} ${positions[position]}`} />;
};

interface TeamMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    college: string;
}

const RegisterPage = () => {
    const navigate = useNavigate();

    // Mark that user navigated away so intro doesn't show when coming back
    React.useEffect(() => {
        sessionStorage.setItem('navigatedAway', 'true');
    }, []);

    const [formData, setFormData] = useState({
        // Team Leader Info
        leaderName: '',
        leaderEmail: '',
        leaderPhone: '',
        leaderCollege: '',
        leaderBranch: '',
        leaderYear: '',
        // Team Info
        teamName: '',
        event: '',
    });

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // REGISTRABLE_EVENTS: Only Aeroprix and Hovermania support registration
    const events = [
        { id: 'aeroprix', label: 'Aeroprix', icon: Plane, description: 'Fixed-wing aircraft competition' },
        { id: 'hovermania', label: 'Hovermania', icon: Rocket, description: 'Hovercraft competition' }
        // Aviation Sim removed - View Details only, no registration
    ];

    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

    const addTeamMember = () => {
        if (teamMembers.length < 4) { // Max 4 additional members (5 total including leader)
            setTeamMembers([...teamMembers, {
                id: Date.now().toString(),
                name: '',
                email: '',
                phone: '',
                college: ''
            }]);
        }
    };

    const removeTeamMember = (id: string) => {
        setTeamMembers(teamMembers.filter(member => member.id !== id));
    };

    const updateTeamMember = (id: string, field: keyof TeamMember, value: string) => {
        setTeamMembers(teamMembers.map(member =>
            member.id === id ? { ...member, [field]: value } : member
        ));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Submit to Supabase
            const result = await registerForEvent({
                event_id: formData.event,
                team_name: formData.teamName,
                leader_name: formData.leaderName,
                leader_email: formData.leaderEmail,
                leader_phone: formData.leaderPhone,
                leader_college: formData.leaderCollege,
                leader_branch: formData.leaderBranch,
                leader_year: formData.leaderYear,
                members: teamMembers.map(m => ({
                    name: m.name,
                    email: m.email,
                    phone: m.phone,
                    college: m.college
                }))
            });

            if (result) {
                setSubmitted(true);
            } else {
                setSubmitError('Failed to submit registration. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setSubmitError('An error occurred. Please try again later.');
        }

        setIsSubmitting(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-nation-black flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-md"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="w-24 h-24 mx-auto mb-8 rounded-full bg-nation-secondary/20 border border-nation-secondary flex items-center justify-center"
                    >
                        <CheckCircle size={48} className="text-nation-secondary" />
                    </motion.div>
                    <h2 className="font-display text-3xl text-white uppercase tracking-widest mb-4">Registration Complete</h2>
                    <p className="text-nation-text mb-4">Your team has been successfully registered for the event!</p>
                    <p className="text-nation-text/70 text-sm mb-8">A confirmation email will be sent to all team members shortly with further instructions.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-4 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.2em] text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant"
                    >
                        Return to Base
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-nation-black relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(59,130,246,0.1) 50px, rgba(59,130,246,0.1) 51px),
                                      repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(59,130,246,0.1) 50px, rgba(59,130,246,0.1) 51px)`
                }} />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 md:px-12 py-4 sm:py-6 glass-dark border-b border-white/10">
                <div className="container mx-auto flex items-center gap-4 sm:gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-nation-text hover:text-white transition-colors group"
                    >
                        <ArrowLeft size={18} className="sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest hidden sm:inline">Back to Base</span>
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Trophy size={14} className="sm:w-4 sm:h-4 text-nation-secondary animate-pulse" />
                        <span className="font-mono text-[8px] sm:text-[10px] text-nation-secondary uppercase tracking-widest">Event Registration</span>
                    </div>
                </div>
            </header>

            {/* Main Content - Mobile: Reduced padding for higher density */}
            <main className="pt-20 sm:pt-32 pb-12 sm:pb-20 px-3 sm:px-6">
                <div className="container mx-auto max-w-4xl">
                    {/* Title - Mobile: Reduced margins and font sizes */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-6 sm:mb-16"
                    >
                        <div className="inline-flex items-center gap-2 mb-2 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 border border-nation-secondary/30 bg-nation-secondary/10 rounded-full">
                            <Trophy size={12} className="sm:w-3.5 sm:h-3.5 text-nation-secondary" />
                            <span className="font-mono text-[9px] sm:text-[10px] text-nation-secondary uppercase tracking-widest">Compete with the Best</span>
                        </div>
                        <h1 className="font-display text-xl sm:text-4xl md:text-6xl text-white uppercase tracking-widest mb-2 sm:mb-4">
                            Event Registration
                        </h1>
                        <p className="text-nation-text max-w-xl mx-auto text-xs sm:text-sm px-2">
                            Register your team for UDAAN's exciting aeromodelling events. Teams can have up to 5 members.
                        </p>
                    </motion.div>

                    {/* Form - Mobile: Reduced spacing for higher density */}
                    <motion.form
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        onSubmit={handleSubmit}
                        className="space-y-4 sm:space-y-8"
                    >
                        {/* Event Selection - Mobile: Reduced padding */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <Target size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Select Event
                            </h3>

                            {/* Mobile: Smaller event cards with 3 columns */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                {events.map(event => (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, event: event.id }))}
                                        className={`p-3 sm:p-6 border rounded-lg transition-all duration-300 flex flex-col items-center gap-1.5 sm:gap-3 text-center ${formData.event === event.id
                                                ? 'bg-nation-secondary/20 border-nation-secondary text-white'
                                                : 'bg-black/30 border-white/10 text-nation-text hover:border-white/30'
                                            }`}
                                    >
                                        <event.icon size={22} className={`sm:w-9 sm:h-9 ${formData.event === event.id ? 'text-nation-secondary' : ''}`} />
                                        <span className="font-display uppercase tracking-wider text-[9px] sm:text-sm">{event.label}</span>
                                        <span className="text-[8px] sm:text-xs opacity-70 hidden sm:block">{event.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team Name - Mobile: Reduced padding */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <Users size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Team Information
                            </h3>

                            <div>
                                <label className="block text-nation-text text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1.5 sm:mb-2">Team Name *</label>
                                <input
                                    type="text"
                                    name="teamName"
                                    autoComplete="off"
                                    spellCheck={false}
                                    value={formData.teamName}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-sm sm:text-base"
                                    placeholder="Enter your team name"
                                />
                            </div>
                        </div>

                        {/* Team Leader Info - Mobile: Reduced padding */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <User size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Team Leader Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        name="leaderName"
                                        autoComplete="name"
                                        autoCapitalize="words"
                                        spellCheck={false}
                                        value={formData.leaderName}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Email *</label>
                                    <input
                                        type="email"
                                        name="leaderEmail"
                                        inputMode="email"
                                        autoComplete="email"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        value={formData.leaderEmail}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="your.email@college.edu"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="leaderPhone"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={formData.leaderPhone}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="+91 XXXXX XXXXX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">College/University *</label>
                                    <input
                                        type="text"
                                        name="leaderCollege"
                                        autoComplete="organization"
                                        spellCheck={false}
                                        value={formData.leaderCollege}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="Enter your college name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Branch *</label>
                                    <input
                                        type="text"
                                        name="leaderBranch"
                                        spellCheck={false}
                                        value={formData.leaderBranch}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="e.g., Mechanical Engineering"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Year *</label>
                                    <select
                                        name="leaderYear"
                                        value={formData.leaderYear}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white focus:border-nation-secondary focus:outline-none transition-colors appearance-none cursor-pointer text-base"
                                    >
                                        <option value="" disabled>Select your year</option>
                                        {years.map(year => (
                                            <option key={year} value={year} className="bg-nation-black">{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Team Members - Mobile: Reduced padding */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <div className="flex items-center justify-between mb-3 sm:mb-6">
                                <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest flex items-center gap-2 sm:gap-3">
                                    <Users size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                    Team Members
                                </h3>
                                <span className="text-nation-text text-[9px] sm:text-xs font-mono">
                                    {teamMembers.length + 1}/5 Members
                                </span>
                            </div>

                            <p className="text-nation-text text-[11px] sm:text-xs mb-4 sm:mb-6">Add up to 4 additional team members (optional). Team leader is already counted.</p>

                            <AnimatePresence>
                                {teamMembers.map((member, index) => (
                                    <motion.div
                                        key={member.id}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mb-6 p-4 sm:p-6 bg-black/30 border border-white/10 rounded-lg relative"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => removeTeamMember(member.id)}
                                            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-full transition-colors"
                                        >
                                            <X size={18} />
                                        </button>

                                        <h4 className="font-display text-xs sm:text-sm text-white uppercase tracking-widest mb-4">
                                            Team Member {index + 1}
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Full Name *</label>
                                                <input
                                                    type="text"
                                                    autoComplete="name"
                                                    autoCapitalize="words"
                                                    spellCheck={false}
                                                    value={member.name}
                                                    onChange={(e) => updateTeamMember(member.id, 'name', e.target.value)}
                                                    required
                                                    className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                                    placeholder="Member's full name"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Email *</label>
                                                <input
                                                    type="email"
                                                    inputMode="email"
                                                    autoComplete="email"
                                                    autoCapitalize="none"
                                                    spellCheck={false}
                                                    value={member.email}
                                                    onChange={(e) => updateTeamMember(member.id, 'email', e.target.value)}
                                                    required
                                                    className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                                    placeholder="member@college.edu"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Phone *</label>
                                                <input
                                                    type="tel"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                    value={member.phone}
                                                    onChange={(e) => updateTeamMember(member.id, 'phone', e.target.value)}
                                                    required
                                                    className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                                    placeholder="+91 XXXXX XXXXX"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">College *</label>
                                                <input
                                                    type="text"
                                                    autoComplete="organization"
                                                    spellCheck={false}
                                                    value={member.college}
                                                    onChange={(e) => updateTeamMember(member.id, 'college', e.target.value)}
                                                    required
                                                    className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                                    placeholder="College name"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {teamMembers.length < 4 && (
                                <button
                                    type="button"
                                    onClick={addTeamMember}
                                    className="w-full p-4 border-2 border-dashed border-white/20 rounded-lg text-nation-text hover:border-nation-secondary hover:text-nation-secondary transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} />
                                    <span className="font-display uppercase tracking-widest text-sm">Add Team Member</span>
                                </button>
                            )}
                        </div>

                        {/* Error Message */}
                        {submitError && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400"
                            >
                                <AlertCircle size={20} />
                                <span className="text-sm">{submitError}</span>
                            </motion.div>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-center pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.event || !formData.teamName}
                                className="group px-8 sm:px-12 py-4 sm:py-5 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-xs sm:text-sm hover:bg-white hover:text-black transition-all duration-300 clip-path-slant shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 sm:gap-3"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                                        Register Team
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.form>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6">
                <div className="container mx-auto text-center">
                    <p className="text-nation-text/50 text-xs font-mono">
                        © 2025 UDAAN Aeromodelling Club, NIT Rourkela. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default RegisterPage;
