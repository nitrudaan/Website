/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, Rocket, Plane, Hexagon, User, Mail, Phone, GraduationCap, BookOpen, Send, CheckCircle, Palette, Briefcase, AlertCircle, Lock } from 'lucide-react';
import { submitApplicant, checkExistingApplicant } from '../utils/supabase';
import { formatName } from '../utils/formatters';
import { sendVerificationEmail, sendCredentialsEmail } from '../utils/email';

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

// Generate a secure temporary password of given length using allowed characters
const generateTempPassword = (length: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.<>?';
    let out = '';
    for (let i = 0; i < length; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        out += chars[idx];
    }
    return out;
};

const JoinCorpsPage = () => {
    const navigate = useNavigate();

    // Induction status for each year
    const [induction1stYearOpen, setInduction1stYearOpen] = useState(false);
    const [induction2ndYearOpen, setInduction2ndYearOpen] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Fetch induction status from config
    useEffect(() => {
        // Add cache-busting to prevent stale config
        fetch(`/config.json?t=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error('Config not found');
                return response.json();
            })
            .then(data => {
                setInduction1stYearOpen(data?.induction1stYearOpen ?? false);
                setInduction2ndYearOpen(data?.induction2ndYearOpen ?? false);
                setConfigLoaded(true);
            })
            .catch((err) => {
                console.error('Config fetch error:', err);
                setInduction1stYearOpen(false);
                setInduction2ndYearOpen(false);
                setConfigLoaded(true);
            });
    }, []);

    // Mark that user navigated away so intro doesn't show when coming back
    useEffect(() => {
        sessionStorage.setItem('navigatedAway', 'true');
    }, []);

    // Department options with codes
    const departments = [
        { code: 'BM', name: 'Biotechnology and Medical Engineering' },
        { code: 'CE', name: 'Civil Engineering' },
        { code: 'CH', name: 'Chemical Engineering' },
        { code: 'CR', name: 'Ceramic Engineering' },
        { code: 'CS', name: 'Computer Science Engineering' },
        { code: 'CY', name: 'Department of Chemistry' },
        { code: 'EC', name: 'Electronics and Communication Engineering' },
        { code: 'EE', name: 'Electrical Engineering' },
        { code: 'EI', name: 'Electronics and Instrumentation Engineering' },
        { code: 'ER', name: 'Earth and Atmospheric Sciences' },
        { code: 'FP', name: 'Food Processing Engineering' },
        { code: 'ID', name: 'Industrial Design' },
        { code: 'LS', name: 'Life Sciences' },
        { code: 'MA', name: 'Department of Mathematics' },
        { code: 'ME', name: 'Mechanical Engineering' },
        { code: 'MM', name: 'Metallurgical and Materials Engineering' },
        { code: 'MN', name: 'Mining Engineering' },
        { code: 'PH', name: 'Department of Physics and Astronomy' },
    ];

    // Extract department code from roll number (e.g., 123CH0497 -> CH)
    const getDeptFromRollNo = (rollNo: string): string => {
        if (!rollNo || rollNo.length < 5) return '';
        // Roll number format: 123XX0XXX where XX is the department code (positions 4-5)
        const match = rollNo.toUpperCase().match(/^\d{3}([A-Z]{2})\d{4}$/);
        return match ? match[1] : '';
    };

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        rollNumber: '',
        department: '',
        year: '',
        interests: [] as string[],
        experience: '',
        whyJoin: ''
    });

    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Email verification state
    const [emailVerified, setEmailVerified] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [showVerificationInput, setShowVerificationInput] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    const [verificationSuccess, setVerificationSuccess] = useState('');
    const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
    // Cooldown state to prevent email spam (60 seconds between sends)
    const [lastEmailSentAt, setLastEmailSentAt] = useState<number>(0);
    const EMAIL_COOLDOWN_MS = 60000; // 60 seconds cooldown

    // Generate 6-digit verification code
    const generateVerificationCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Handle sending verification code
    const handleSendVerificationCode = async () => {
        if (!formData.email) {
            setVerificationError('Please enter your email first');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setVerificationError('Please enter a valid email address');
            return;
        }

        // Check if it's a personal email
        if (!isValidPersonalEmail(formData.email)) {
            setVerificationError('Please use a personal email (gmail, yahoo, outlook, etc.)');
            return;
        }

        // Cooldown check to prevent email spam
        const now = Date.now();
        if (lastEmailSentAt && now - lastEmailSentAt < EMAIL_COOLDOWN_MS) {
            const secondsRemaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - lastEmailSentAt)) / 1000);
            setVerificationError(`Please wait ${secondsRemaining} seconds before requesting another code.`);
            return;
        }

        setIsSendingCode(true);
        setVerificationError('');
        setVerificationSuccess('');

        const code = generateVerificationCode();
        setGeneratedCode(code);
        setCodeExpiry(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutes

        try {
            // Send email via Google Apps Script
            const result = await sendVerificationEmail(
                formData.email,
                formatName(formData.name) || 'Applicant',
                code
            );

            if (result) {
                // Record successful send time for cooldown
                setLastEmailSentAt(Date.now());
                setShowVerificationInput(true);
                setVerificationSuccess(`Verification code sent to ${formData.email}. Check your inbox (and spam folder).`);
            } else {
                // Email service failed - show generic error
                setVerificationError('Unable to send verification email. Please try again or contact support.');
                setShowVerificationInput(false);
            }
        } catch (error) {
            setVerificationError('Unable to send verification email. Please try again later.');
            setShowVerificationInput(false);
        }

        setIsSendingCode(false);
    };

    // Handle verifying the code
    const handleVerifyCode = () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setVerificationError('Please enter the 6-digit verification code');
            return;
        }

        // Check if code expired
        if (codeExpiry && new Date() > codeExpiry) {
            setVerificationError('Verification code has expired. Please request a new code.');
            setGeneratedCode('');
            return;
        }

        if (verificationCode === generatedCode) {
            setEmailVerified(true);
            setShowVerificationInput(false);
            setVerificationCode('');
            setVerificationSuccess('Email verified successfully!');
            setVerificationError('');
            // NOTE: Credentials are generated after successful form submission
            // and verified email. Do not generate credentials here to avoid
            // accidental sends on page refresh or before submission.
        } else {
            setVerificationError('Invalid verification code. Please try again.');
        }
    };

    // Reset verification when email changes
    const handleEmailChange = (email: string) => {
        setFormData(prev => ({ ...prev, email }));
        if (emailVerified) {
            setEmailVerified(false);
            setShowVerificationInput(false);
            setVerificationCode('');
            setGeneratedCode('');
            setVerificationSuccess('');
        }
    };

    const interests = [
        { id: 'drone', label: 'Drone', icon: Hexagon },
        { id: 'rcplane', label: 'RC Plane', icon: Plane },
        { id: 'rocketry', label: 'Rocketry', icon: Rocket },
        { id: 'creative', label: 'Creative & Web', icon: Palette },
        { id: 'management', label: 'Management', icon: Briefcase }
    ];

    // Dynamic years based on which inductions are open
    const years = [
        ...(induction1stYearOpen ? ['1st Year'] : []),
        ...(induction2ndYearOpen ? ['2nd Year'] : [])
    ];

    const handleInterestToggle = (id: string) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.includes(id)
                ? prev.interests.filter(i => i !== id)
                : [...prev.interests, id]
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'rollNumber') {
            const upperValue = value.toUpperCase();
            const deptCode = getDeptFromRollNo(upperValue);
            const matchedDept = departments.find(d => d.code === deptCode);

            setFormData(prev => ({
                ...prev,
                rollNumber: upperValue,
                department: matchedDept ? `${matchedDept.name} (${matchedDept.code})` : prev.department
            }));
        } else if (name === 'phone') {
            // Accept only numeric input and limit to 10 digits (no country code or formatting)
            const digits = value.replace(/\D/g, '').slice(0, 10);
            setFormData(prev => ({ ...prev, phone: digits }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Validate personal email (gmail, yahoo, outlook, etc.)
    const isValidPersonalEmail = (email: string): boolean => {
        const personalDomains = ['gmail.com', 'yahoo.com', 'yahoo.in', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'rediffmail.com'];
        const emailLower = email.toLowerCase();
        return personalDomains.some(domain => emailLower.endsWith('@' + domain));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check email verification first
        if (!emailVerified) {
            alert('Please verify your email before submitting the application.');
            return;
        }

        // Validate personal email
        if (!isValidPersonalEmail(formData.email)) {
            alert('Please enter a valid personal email (e.g., @gmail.com, @yahoo.com, @outlook.com)');
            return;
        }

        // Validate roll number format (9 characters)
        if (formData.rollNumber.length !== 9) {
            alert('Please enter a valid 9-character roll number (e.g., 123CH0497)');
            return;
        }

        // Validate at least one interest selected
        if (formData.interests.length === 0) {
            alert('Please select at least one area of interest');
            return;
        }

        setIsSubmitting(true);

        try {
            // Check if already applied
            const exists = await checkExistingApplicant(formData.email, formData.rollNumber);
            if (exists) {
                alert('You have already submitted an application with this email or roll number.');
                setIsSubmitting(false);
                return;
            }

            // Submit to database
            const result = await submitApplicant({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                roll_no: formData.rollNumber,
                department: formData.department,
                year: formData.year,
                interests: formData.interests,
                experience: formData.experience,
                why_join: formData.whyJoin,
                email_verified: emailVerified  // Pass the verification status
            });

            if (result) {
                // Applicant record created. Credentials and member account
                // will be created by council when candidates are promoted to Induction.
                setSubmitted(true);
            } else {
                alert('Failed to submit application. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show success screen after submission
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
                    <p className="text-nation-text mb-8">Welcome to the squadron, pilot. You'll receive a confirmation at your registered email shortly.</p>
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
                        <Target size={14} className="sm:w-4 sm:h-4 text-nation-secondary animate-spin-slow" />
                        <span className="font-mono text-[8px] sm:text-[10px] text-nation-secondary uppercase tracking-widest">Recruitment Active</span>
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
                            <Rocket size={12} className="sm:w-3.5 sm:h-3.5 text-nation-secondary" />
                            <span className="font-mono text-[9px] sm:text-[10px] text-nation-secondary uppercase tracking-widest">Join the Squadron</span>
                        </div>
                        <h1 className="font-display text-xl sm:text-4xl md:text-6xl text-white uppercase tracking-widest mb-2 sm:mb-4">
                            Pilot Registration
                        </h1>
                        <p className="text-nation-text max-w-xl mx-auto text-xs sm:text-sm px-2">
                            Begin your journey with UDAAN. Fill in your details below to join Eastern India's premier aeromodelling community.
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
                        {/* Personal Info Section - Mobile: Reduced padding */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <User size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Personal Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                                <div>
                                    <label className="block text-nation-text text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1.5 sm:mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        autoComplete="name"
                                        autoCapitalize="words"
                                        spellCheck={false}
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-sm sm:text-base"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-nation-text text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1.5 sm:mb-2">
                                        Personal Email *
                                        {emailVerified && (
                                            <span className="ml-2 text-green-400 normal-case">✓ Verified</span>
                                        )}
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="email"
                                            name="email"
                                            inputMode="email"
                                            autoComplete="email"
                                            autoCapitalize="none"
                                            spellCheck={false}
                                            value={formData.email}
                                            onChange={(e) => handleEmailChange(e.target.value)}
                                            required
                                            disabled={emailVerified}
                                            className={`flex-1 bg-black/50 border rounded px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-white/30 focus:outline-none transition-colors text-sm sm:text-base ${emailVerified
                                                    ? 'border-green-500/50 cursor-not-allowed'
                                                    : 'border-white/10 focus:border-nation-secondary'
                                                }`}
                                            placeholder="yourname@gmail.com"
                                        />
                                        {!emailVerified && (
                                            <button
                                                type="button"
                                                onClick={handleSendVerificationCode}
                                                disabled={isSendingCode || !formData.email}
                                                className="w-full sm:w-auto px-4 py-2.5 sm:py-3 bg-nation-secondary/20 border border-nation-secondary/50 rounded text-nation-secondary hover:bg-nation-secondary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                                            >
                                                {isSendingCode ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-nation-secondary/30 border-t-nation-secondary rounded-full animate-spin"></div>
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mail size={16} />
                                                        Verify Email
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Verification Messages */}
                                    {verificationError && (
                                        <p className="text-red-400 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            {verificationError}
                                        </p>
                                    )}
                                    {verificationSuccess && (
                                        <p className="text-green-400 text-[10px] sm:text-xs mt-2 flex items-center gap-1">
                                            <CheckCircle size={12} />
                                            {verificationSuccess}
                                        </p>
                                    )}

                                    {/* Verification Code Input */}
                                    {showVerificationInput && !emailVerified && (
                                        <div className="mt-3 p-3 sm:p-4 bg-nation-secondary/10 border border-nation-secondary/30 rounded-lg space-y-3">
                                            <p className="text-nation-secondary text-[10px] sm:text-xs">
                                                Enter the 6-digit code sent to your email:
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    autoComplete="one-time-code"
                                                    value={verificationCode}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                        setVerificationCode(value);
                                                    }}
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2.5 sm:px-4 sm:py-2 text-white text-center font-mono text-lg sm:text-xl tracking-[0.5em] placeholder-white/30 focus:outline-none focus:border-nation-secondary"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyCode}
                                                    disabled={isVerifyingCode || verificationCode.length !== 6}
                                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                                >
                                                    <CheckCircle size={16} />
                                                    Confirm
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendVerificationCode}
                                                disabled={isSendingCode}
                                                className="text-nation-secondary/70 text-[10px] sm:text-xs hover:text-nation-secondary transition-colors"
                                            >
                                                Didn't receive code? Resend
                                            </button>
                                        </div>
                                    )}

                                    {!emailVerified && formData.email && !showVerificationInput && (
                                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-start gap-2">
                                            <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-yellow-400/90 text-[11px] sm:text-xs">
                                                Email verification required. Click "Verify Email" button above to receive a code.
                                            </p>
                                        </div>
                                    )}
                                    {!formData.email && (
                                        <p className="text-nation-text/50 text-[10px] sm:text-xs mt-1.5">Use @gmail.com, @yahoo.com, @outlook.com, etc.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base"
                                        placeholder="e.g., 9191919191"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Roll Number *</label>
                                    <input
                                        type="text"
                                        name="rollNumber"
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={formData.rollNumber}
                                        onChange={handleChange}
                                        required
                                        maxLength={9}
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors text-base uppercase"
                                        placeholder="e.g., 123XX001"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Academic Info Section */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-5 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-base sm:text-lg text-white uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <GraduationCap size={16} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Academic Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">
                                        Department *
                                    </label>
                                    <select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white focus:border-nation-secondary focus:outline-none transition-colors appearance-none cursor-pointer text-base"
                                    >
                                        <option value="" disabled>Select your department</option>
                                        {departments.map(dept => (
                                            <option key={dept.code} value={`${dept.name} (${dept.code})`} className="bg-nation-black">
                                                {dept.name} ({dept.code})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-nation-secondary/70 text-xs mt-1">
                                        {formData.rollNumber && getDeptFromRollNo(formData.rollNumber)
                                            ? `Auto-detected: ${getDeptFromRollNo(formData.rollNumber)}`
                                            : 'Auto-detected from Roll No.'
                                        }
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-nation-text text-xs font-mono uppercase tracking-widest mb-2">Year *</label>
                                    {!configLoaded ? (
                                        <div className="bg-nation-secondary/10 border border-nation-secondary/30 rounded px-4 py-3 text-nation-secondary text-sm flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-nation-secondary/30 border-t-nation-secondary rounded-full animate-spin"></div>
                                            Loading options...
                                        </div>
                                    ) : years.length === 0 ? (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-red-400 text-sm">
                                            <AlertCircle size={16} className="inline mr-2" />
                                            No inductions are currently open. Please check back later.
                                        </div>
                                    ) : (
                                        <select
                                            name="year"
                                            value={formData.year}
                                            onChange={handleChange}
                                            required
                                            className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white focus:border-nation-secondary focus:outline-none transition-colors appearance-none cursor-pointer text-base"
                                        >
                                            <option value="" disabled>Select your year</option>
                                            {years.map(year => (
                                                <option key={year} value={year} className="bg-nation-black">{year}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Interests Section - Mobile: Reduced padding and card sizes */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <Target size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Areas of Interest
                            </h3>

                            <p className="text-nation-text text-[11px] sm:text-xs mb-3 sm:mb-6">Select the divisions you're interested in (select at least one)</p>

                            {/* Mobile: 3 columns with smaller cards */}
                            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                                {interests.map(interest => (
                                    <button
                                        key={interest.id}
                                        type="button"
                                        onClick={() => handleInterestToggle(interest.id)}
                                        className={`p-2 sm:p-4 md:p-5 border rounded-lg transition-all duration-300 flex flex-col items-center justify-center gap-1.5 sm:gap-3 min-h-[70px] sm:min-h-[120px] ${formData.interests.includes(interest.id)
                                                ? 'bg-nation-secondary/20 border-nation-secondary text-white'
                                                : 'bg-black/30 border-white/10 text-nation-text hover:border-white/30'
                                            }`}
                                    >
                                        <interest.icon size={16} className={`sm:w-6 sm:h-6 md:w-7 md:h-7 flex-shrink-0 ${formData.interests.includes(interest.id) ? 'text-nation-secondary' : ''}`} />
                                        <span className="font-display uppercase tracking-wider text-[7px] sm:text-[10px] md:text-xs text-center leading-tight">{interest.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Experience Section - Mobile: Reduced padding and spacing */}
                        <div className="bg-nation-panel/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-8 relative">
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <h3 className="font-display text-sm sm:text-lg text-white uppercase tracking-widest mb-3 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                <BookOpen size={14} className="sm:w-[18px] sm:h-[18px] text-nation-secondary" />
                                Tell Us More
                            </h3>

                            <div className="space-y-4 sm:space-y-6">
                                <div>
                                    <label className="block text-nation-text text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1.5 sm:mb-2">Previous Experience / Reason of Interest *</label>
                                    <textarea
                                        name="experience"
                                        value={formData.experience}
                                        onChange={handleChange}
                                        required
                                        rows={2}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors resize-none text-sm sm:text-base"
                                        placeholder="Any prior experience with aeromodelling, RC aircraft, drones, etc.?"
                                    />
                                </div>
                                <div>
                                    <label className="block text-nation-text text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1.5 sm:mb-2">Why do you want to join UDAAN? *</label>
                                    <textarea
                                        name="whyJoin"
                                        value={formData.whyJoin}
                                        onChange={handleChange}
                                        required
                                        rows={3}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-white/30 focus:border-nation-secondary focus:outline-none transition-colors resize-none text-sm sm:text-base"
                                        placeholder="Tell us about your passion for aviation and what you hope to achieve..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button - Mobile: Reduced padding for compact look */}
                        <div className="flex flex-col items-center gap-3 pt-2 sm:pt-4">
                            {!emailVerified && (
                                <p className="text-yellow-400 text-xs text-center flex items-center gap-1">
                                    <AlertCircle size={14} />
                                    Please verify your email before submitting
                                </p>
                            )}
                            {formData.interests.length === 0 && (
                                <p className="text-yellow-400 text-xs text-center flex items-center gap-1">
                                    <AlertCircle size={14} />
                                    Please select at least one area of interest
                                </p>
                            )}
                            {!configLoaded && (
                                <p className="text-nation-secondary text-xs text-center flex items-center gap-1">
                                    <div className="w-3 h-3 border-2 border-nation-secondary/30 border-t-nation-secondary rounded-full animate-spin"></div>
                                    Loading configuration...
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || formData.interests.length === 0 || !configLoaded || years.length === 0 || !emailVerified}
                                className="group px-6 sm:px-12 py-3 sm:py-5 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-xs sm:text-sm hover:bg-white hover:text-black transition-all duration-300 clip-path-slant shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 sm:gap-3"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} className="sm:w-[18px] sm:h-[18px] group-hover:translate-x-1 transition-transform" />
                                        Submit Registration
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

export default JoinCorpsPage;
