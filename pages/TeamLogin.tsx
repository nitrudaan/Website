/**
 * Team Member Portal - Full Dashboard
 * Members can log in to view their dashboard with tasks, assignments, and ID
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, User, Lock, AlertCircle, Shield, Fingerprint, QrCode, Crown, Star,
    Scroll, Briefcase, Hexagon, Plane, Rocket, Target, Smartphone, Palette,
    CheckCircle2, Clock, AlertTriangle, Calendar, ChevronRight, ChevronDown, Plus, Check,
    ListTodo, ClipboardList, Bell, Settings, LogOut, BarChart3, Users,
    FileText, MessageSquare, Award, TrendingUp, Circle, Send, X, Trash2, UserPlus,
    Eye, Edit3, MoreVertical, Phone, Mail, Hash, ExternalLink, Camera, Upload, Search,
    ToggleLeft, ToggleRight
} from 'lucide-react';

import {
    loginMember,
    getMembers,
    getActiveMembers,
    getAssignableMembers,
    isSuperAdmin,
    initializeSuperAdmin,
    transferCouncil,
    getAnnouncementsForMember,
    getTasksForMemberByRole,
    createTask,
    getTasksAssignedBy,
    deleteTask,
    updateTaskStatus as updateTaskStatusInDB,
    addMemberWithYear,
    getAllTasksForMember,
    createSelfTask,
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement as deleteAnnouncementFromDB,
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteOldNotifications,
    createNotification,
    createBulkNotifications,
    logActivity,
    getRecentActivity,
    removeMemberCompletely,
    changeMemberPassword,
    updateMemberProfile,
    sendEmailVerificationCode,
    verifyEmailCode,
    getEmailVerificationStatus,
    resetEmailVerification,
    // phone verification functions removed
    submitDivisionRequest,
    hasPendingDivisionRequest,
    canSubmitDivisionRequest,
    notifyDivisionRequest,
    getDivisionRequests,
    approveDivisionRequest,
    rejectDivisionRequest,
    deleteOldDivisionRequests,
    getPendingDivisionRequestsCount,
    DIVISION_HEADS,
    canUploadPhoto,
    uploadMemberPhoto,
    toggleMemberInactiveStatus,
    supabase,
    getApplicants,
    promoteApplicantToStage2,
    getProvisionalMembersCount,
    type Member as SupabaseMember,
    type Task as SupabaseTask,
    type Announcement as SupabaseAnnouncement,
    type Notification as SupabaseNotification,
    type ActivityLog,
    type DivisionRequest,
} from '../utils/supabase';
import { sendCredentialsEmail } from '../utils/email';
import * as XLSX from 'xlsx';
import { formatName, formatFirstName } from '../utils/formatters';

// Map role to icon
const getRoleIcon = (role: string): string => {
    if (role.toLowerCase().includes('president') && !role.toLowerCase().includes('vice')) return 'shield';
    if (role.toLowerCase().includes('vice president')) return 'star';
    if (role.toLowerCase().includes('secretary')) return 'scroll';
    if (role.toLowerCase().includes('treasurer') || role.toLowerCase().includes('management')) return 'briefcase';
    if (role.toLowerCase().includes('drone')) return 'hexagon';
    if (role.toLowerCase().includes('plane')) return 'plane';
    if (role.toLowerCase().includes('rocket')) return 'rocket';
    return 'target';
};

// Sample tasks data - empty, all data comes from database
const sampleTasks: { [key: string]: Task[] } = {};

// Sample announcements - empty, all data comes from database
const initialAnnouncements: Announcement[] = [];

interface Task {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
    assignedBy: string;
    category: string;
    description?: string;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    date: string;
    type: 'meeting' | 'update' | 'deadline' | 'important';
    createdBy: string;
}

const PromoteButton = ({ applicant, onPromoted }: { applicant: any; onPromoted?: () => void }) => {
    const [loading, setLoading] = useState(false);
    const handlePromote = async () => {
        if (!confirm(`Promote ${applicant.name} to Stage 2 and send credentials?`)) return;
        setLoading(true);
        try {
            const res = await promoteApplicantToStage2(applicant.id, 'UDAAN-001');
            if (!res.success || !res.member) {
                alert('Failed to promote: ' + (res.error || 'Unknown'));
                setLoading(false);
                return;
            }

            // Send credentials email
            try {
                await sendCredentialsEmail(applicant.email, applicant.name, res.member.member_id, res.tempPassword || '');
            } catch (e) {
                // ignore email errors
            }

            alert(`Promoted ${applicant.name} — member ID ${res.member.member_id}. Credentials emailed (check spam folder).`);
            if (onPromoted) await onPromoted();
        } catch (err) {
            alert('An error occurred while promoting.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePromote}
            disabled={loading}
            className="px-3 py-1 text-xs bg-nation-secondary text-black rounded-md"
        >
            {loading ? 'Promoting...' : 'Promote to Stage 2'}
        </button>
    );
};

// Extended member type with icon
interface Member extends SupabaseMember {
    icon: string;
}

const getIcon = (iconName: string, size = 24) => {
    const icons: { [key: string]: React.ReactNode } = {
        crown: <Crown size={size} />,
        shield: <Shield size={size} />,
        scroll: <Scroll size={size} />,
        briefcase: <Briefcase size={size} />,
        hexagon: <Hexagon size={size} />,
        plane: <Plane size={size} />,
        rocket: <Rocket size={size} />,
        target: <Target size={size} />,
        user: <User size={size} />,
    };

    return icons[iconName] || <Target size={size} />;
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'completed': return <CheckCircle2 size={16} className="text-green-400" />;
        case 'in-progress': return <Clock size={16} className="text-yellow-400" />;
        case 'pending': return <Circle size={16} className="text-gray-400" />;
        default: return <Circle size={16} className="text-gray-400" />;
    }
};

// Map task priority to tailwind color classes used for badges/borders
const getPriorityColor = (priority: string) => {
    switch ((priority || '').toLowerCase()) {
        case 'high':
            return 'border-red-300 text-red-700 bg-red-50';
        case 'medium':
            return 'border-yellow-300 text-yellow-700 bg-yellow-50';
        case 'low':
            return 'border-green-300 text-green-700 bg-green-50';
        default:
            return 'border-gray-300 text-gray-700 bg-white';
    }
};

// Sidebar Component
const Sidebar = ({ member, activeTab, setActiveTab, onLogout, unreadCount, pendingRequestsCount }: {
    member: Member;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onLogout: () => void;
    unreadCount: number;
    pendingRequestsCount: number;
}) => {
    const navigate = useNavigate();
    const isCouncil = member.clearance === 5;
    const isPresident = member.role.toLowerCase().includes('president') && !member.role.toLowerCase().includes('vice');
    const is4thYear = member.year === 4;
    const superAdmin = isSuperAdmin(member.member_id);
    const isAlumni = member.role === 'Alumni' || member.year === 0;
    const isProvisional = member.status === 'provisional';
    const canAssignTasks = (isCouncil || is4thYear) && !isAlumni;

    // Check if current member is a division head
    const isDivisionHead = Object.values(DIVISION_HEADS).some(h => h.member_id === member.member_id);
    // Track whether any Induction is currently active (fetched from public config)
    const [inductionActive, setInductionActive] = React.useState(false);

    useEffect(() => {
        let mounted = true;
        fetch('/config.json')
            .then(r => r.ok ? r.json() : Promise.reject('no config'))
            .then(data => {
                if (!mounted) return;
                setInductionActive(Boolean(data?.induction1stYearOpen || data?.induction2ndYearOpen));
            })
            .catch(() => {
                if (!mounted) return;
                setInductionActive(false);
            });
        return () => { mounted = false; };
    }, []);

    // Check if profile is incomplete (needs attention)
    const isProfileIncomplete = !member.roll_no || !member.phone || !member.personal_email || !member.email_verified;

    // Build menu items based on role
    // Super Admin: All items + council transfer
    // Council: Standard council items
    // Alumni: Limited items (dashboard, notifications, announcements, ID card, settings)
    // Regular: Standard member items
    let menuItems: { id: string; label: string; icon: React.ReactNode; badge: number; showDot: boolean; completed?: boolean }[] = [];

    if (isProvisional) {
        // Provisional (induction) members - show induction tasks
        // Task 1 is marked as completed since they've already registered to be able to login
        menuItems = [
            { id: 'whatsapp-group', label: 'WhatsApp Group', icon: <Smartphone size={20} />, badge: 0, showDot: false },
            { id: 'task-registration', label: 'Task 1 (Registration)', icon: <ClipboardList size={20} />, badge: 0, showDot: false, completed: true },
            { id: 'task-online-test', label: 'Task 2 (Online Test)', icon: <FileText size={20} />, badge: 0, showDot: false, completed: true },
            { id: 'task-assigned', label: 'Task 3 (Assigned Task)', icon: <ListTodo size={20} />, badge: 0, showDot: false },
            { id: 'settings', label: 'Settings', icon: <Settings size={20} />, badge: 0, showDot: false },
        ];
    } else if (isAlumni && !superAdmin) {
        // Alumni have limited access
        menuItems = [
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={20} />, badge: 0, showDot: false },
            { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, badge: unreadCount, showDot: false },
            { id: 'id-card', label: 'ID Card', icon: <User size={20} />, badge: 0, showDot: false },
            { id: 'settings', label: 'Settings', icon: <Settings size={20} />, badge: 0, showDot: false },
        ];
    } else if (superAdmin) {
        // Super Admin has all access plus council transfer and admin reports
        menuItems = [
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={20} />, badge: 0, showDot: false },
            { id: 'admin-report', label: 'Admin Report', icon: <FileText size={20} />, badge: 0, showDot: false },
            { id: 'tasks', label: 'All Tasks', icon: <ListTodo size={20} />, badge: 0, showDot: false },
            { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, badge: unreadCount, showDot: false },
            { id: 'add-member', label: 'Add Member', icon: <UserPlus size={20} />, badge: 0, showDot: false },
            { id: 'announcements', label: 'Announcements', icon: <MessageSquare size={20} />, badge: 0, showDot: false },
            { id: 'council-transfer', label: 'Council Transfer', icon: <Crown size={20} />, badge: 0, showDot: false },
            { id: 'team', label: 'Team', icon: <Users size={20} />, badge: 0, showDot: false },
            { id: 'settings', label: 'Settings', icon: <Settings size={20} />, badge: 0, showDot: false },
        ];
    } else {
        // Regular members and council
        menuItems = [
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={20} />, badge: 0, showDot: false },
            { id: 'tasks', label: 'My Tasks', icon: <ListTodo size={20} />, badge: 0, showDot: false },
            { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, badge: unreadCount, showDot: false },
            // Only show "Assigned to Me" for non-council members
            ...(!isCouncil ? [{ id: 'assigned', label: 'Assigned to Me', icon: <ClipboardList size={20} />, badge: 0, showDot: false }] : []),
            // Show "Assign Task" for council members and 4th year members
            ...(canAssignTasks ? [{ id: 'assign-task', label: 'Assign Task', icon: <Send size={20} />, badge: 0, showDot: false }] : []),
            ...(isCouncil ? [{ id: 'add-member', label: 'Add Member', icon: <UserPlus size={20} />, badge: 0, showDot: false }] : []),
            ...(isCouncil ? [{ id: 'announcements', label: 'Announcements', icon: <MessageSquare size={20} />, badge: 0, showDot: false }] : []),
            // Show Division Requests for council members (division heads)
            ...(isCouncil || isDivisionHead ? [{ id: 'division-requests', label: 'Division Requests', icon: <UserPlus size={20} />, badge: pendingRequestsCount, showDot: false }] : []),
            // Show Induction Applications for council members when induction is active, OR always for President
            ...(((isCouncil && inductionActive) || isPresident) ? [{ id: 'join-corps-applications', label: 'Induction Applications', icon: <FileText size={20} />, badge: 0, showDot: false }] : []),
            // Show Induction Approvals for President only
            ...(isPresident ? [{ id: 'induction-approvals', label: 'Induction Approvals', icon: <UserPlus size={20} />, badge: 0, showDot: false }] : []),
            { id: 'id-card', label: 'ID Card', icon: <User size={20} />, badge: 0, showDot: false },
            { id: 'team', label: 'Team', icon: <Users size={20} />, badge: 0, showDot: false },
            { id: 'settings', label: 'Settings', icon: <Settings size={20} />, badge: 0, showDot: isProfileIncomplete },
        ];
    }

    return (
        <div className="hidden lg:flex w-64 flex-col h-screen fixed left-0 top-0 z-40 border-r border-white/10" style={{ backgroundColor: '#111827' }}>
            {/* Logo */}
            <div className="p-4 border-b border-white/10" style={{ backgroundColor: '#111827' }}>
                <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity w-full">
                    <img src="/udaan-logo.webp" alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                    <div className="min-w-0 overflow-hidden">
                        <h1 className="text-white font-bold text-lg tracking-wider whitespace-nowrap">UDAAN</h1>
                        <p className="text-white/40 text-[8px] uppercase tracking-widest whitespace-nowrap">Member Portal</p>
                    </div>
                </button>
            </div>

            {/* Profile Section */}
            <div className="p-4 border-b border-white/10" style={{ backgroundColor: '#111827' }}>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                        {getIcon(member.icon, 18)}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-white font-bold text-sm truncate">{formatName(member.name)}</h3>
                        {isProvisional ? null : member.personal_email && member.email_verified ? (
                            <p className="text-white/50 text-[10px] truncate flex items-center gap-1">
                                {member.personal_email}
                                <CheckCircle2 size={10} className="text-green-400 flex-shrink-0" />
                            </p>
                        ) : (
                            <p className="text-white/50 text-[10px] truncate">{member.role}</p>
                        )}
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2 overflow-hidden">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></span>
                    <span className="text-green-400 text-[10px] font-mono truncate whitespace-nowrap">Online • {member.member_id}</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0 sidebar-scroll" style={{ backgroundColor: '#111827' }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => !item.completed && setActiveTab(item.id)}
                        disabled={item.completed}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === item.id
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                            } ${item.completed ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                        {item.icon}
                        <span className={`text-sm font-medium flex-1 text-left ${item.completed ? 'line-through opacity-60' : ''}`}>
                            {item.label}
                        </span>
                        {item.completed && (
                            <CheckCircle2 size={16} className="text-green-400" />
                        )}
                        {item.badge > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                {item.badge > 99 ? '99+' : item.badge}
                            </span>
                        )}
                        {item.showDot && (
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-white/10 space-y-1" style={{ backgroundColor: '#111827' }}>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                    <LogOut size={20} />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </div >
    );
};

// Mobile Header - Compact design for higher mobile density
const MobileHeader = ({ member, onLogout }: { member: Member; onLogout: () => void }) => {
    const navigate = useNavigate();
    return (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-b border-white/5 px-3 py-2">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate('/')} className="flex items-center gap-1.5">
                    <img src="/udaan-logo.webp" alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                    <span className="text-white font-bold text-sm whitespace-nowrap">UDAAN</span>
                </button>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                            {getIcon(member.icon, 12)}
                        </div>
                        <span className="text-white text-xs font-medium hidden sm:block">{formatFirstName(member.name)}</span>
                    </div>
                    <button onClick={onLogout} className="p-1.5 text-white/60 hover:text-red-400">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Dashboard Tab
const DashboardTab = ({ member, tasks, announcements }: { member: Member; tasks: Task[]; announcements: Announcement[] }) => {
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

    const stats = [
        { label: 'Pending', value: pendingTasks, icon: <Circle size={20} />, color: 'text-gray-400 bg-gray-500/10' },
        { label: 'In Progress', value: inProgressTasks, icon: <Clock size={20} />, color: 'text-yellow-400 bg-yellow-500/10' },
        { label: 'Completed', value: completedTasks, icon: <CheckCircle2 size={20} />, color: 'text-green-400 bg-green-500/10' },
        { label: 'High Priority', value: highPriorityTasks, icon: <AlertTriangle size={20} />, color: 'text-red-400 bg-red-500/10' },
    ];

    const getAnnouncementColor = (type: string) => {
        switch (type) {
            case 'meeting': return 'bg-blue-400';
            case 'deadline': return 'bg-red-400';
            case 'important': return 'bg-yellow-400';
            default: return 'bg-green-400';
        }
    };

    return (
        // Mobile: Reduced vertical spacing (space-y-4) for higher density, desktop unchanged (space-y-6)
        <div className="space-y-4 lg:space-y-6">
            {/* Welcome Header - Mobile: Reduced padding (p-4) for compact look */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-500/20">
                <h1 className="text-lg lg:text-2xl font-bold text-white mb-1 lg:mb-2">Welcome back, {formatFirstName(member.name)}! 👋</h1>
                <p className="text-white/60 text-sm lg:text-base">Here's what's happening with your tasks today.</p>
            </div>

            {/* Stats Grid - Mobile: Reduced gap (gap-2) and padding (p-3) for compact layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gray-800/50 rounded-lg lg:rounded-xl p-3 lg:p-4 border border-white/5"
                    >
                        <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-md lg:rounded-lg ${stat.color} flex items-center justify-center mb-2 lg:mb-3`}>
                            <span className="[&>svg]:w-4 [&>svg]:h-4 lg:[&>svg]:w-5 lg:[&>svg]:h-5">{stat.icon}</span>
                        </div>
                        <p className="text-xl lg:text-2xl font-bold text-white">{stat.value}</p>
                        <p className="text-white/50 text-xs lg:text-sm">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Recent Tasks & Announcements - Mobile: Reduced gap */}
            <div className="grid lg:grid-cols-2 gap-3 lg:gap-6">
                {/* Recent Tasks - Mobile: Reduced padding for higher density */}
                <div className="bg-gray-800/30 rounded-lg lg:rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-3 py-2.5 lg:px-5 lg:py-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-white font-bold text-sm lg:text-base">Ongoing Tasks</h2>
                        <span className="text-[10px] lg:text-xs text-white/40 font-mono">{tasks.filter(t => t.status !== 'completed').length} active</span>
                    </div>
                    <div className="divide-y divide-white/5 max-h-60 lg:max-h-80 overflow-y-auto">
                        {tasks.filter(t => t.status !== 'completed').slice(0, 5).map((task) => (
                            <div key={task.id} className="px-3 py-2.5 lg:px-5 lg:py-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-start gap-2 lg:gap-3">
                                    {getStatusIcon(task.status)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs lg:text-sm font-medium truncate">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5 lg:mt-1">
                                            <span className={`text-[9px] lg:text-[10px] px-1.5 lg:px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                            <span className="text-white/40 text-[9px] lg:text-[10px]">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {tasks.filter(t => t.status !== 'completed').length === 0 && (
                            <div className="px-3 py-6 lg:px-5 lg:py-8 text-center text-white/40 text-xs lg:text-sm">No active tasks 🎉</div>
                        )}
                    </div>
                </div>

                {/* Announcements - Mobile: Reduced padding for higher density */}
                <div className="bg-gray-800/30 rounded-lg lg:rounded-xl border border-white/5 overflow-hidden">
                    <div className="px-3 py-2.5 lg:px-5 lg:py-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-white font-bold text-sm lg:text-base">Announcements</h2>
                        <Bell size={14} className="lg:w-4 lg:h-4 text-white/40" />
                    </div>
                    <div className="divide-y divide-white/5 max-h-60 lg:max-h-80 overflow-y-auto">
                        {announcements.length > 0 ? announcements.map((ann) => (
                            <div key={ann.id} className="px-3 py-2.5 lg:px-5 lg:py-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-start gap-2 lg:gap-3">
                                    <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full mt-1.5 lg:mt-2 flex-shrink-0 ${getAnnouncementColor(ann.type)}`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-xs lg:text-sm font-medium">{ann.title}</p>
                                        <p className="text-white/50 text-[11px] lg:text-xs mt-0.5 lg:mt-1 line-clamp-2">{ann.content}</p>
                                        <div className="flex items-center gap-2 mt-1.5 lg:mt-2">
                                            <span className={`text-[9px] lg:text-[10px] px-1.5 lg:px-2 py-0.5 rounded-full border capitalize ${ann.type === 'important' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                                ann.type === 'deadline' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                                    ann.type === 'meeting' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                                        'text-green-400 border-green-500/30 bg-green-500/10'
                                                }`}>
                                                {ann.type}
                                            </span>
                                            <span className="text-white/40 text-[10px]">{new Date(ann.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="px-5 py-8 text-center text-white/40 text-sm">No announcements</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Calendar Section - Mobile: Reduced padding for higher density */}
            <div className="bg-gray-800/30 rounded-lg lg:rounded-xl border border-white/5 p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2 lg:mb-3">
                    <h2 className="text-white font-bold flex items-center gap-2 text-xs lg:text-sm">
                        <Calendar size={14} className="lg:w-4 lg:h-4 text-blue-400" />
                        Upcoming Events
                    </h2>
                </div>

                {/* Calendar and Events Side by Side - Mobile: Reduced gap */}
                <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                    {/* Calendar Mini View */}
                    <div className="lg:w-72 flex-shrink-0">
                        <CalendarWidget tasks={tasks} announcements={announcements} />
                    </div>

                    {/* Monthly Events List */}
                    <MonthlyEventsList tasks={tasks} announcements={announcements} />
                </div>
            </div>
        </div>
    );
};

// Monthly Events List Component
const MonthlyEventsList = ({ tasks, announcements }: { tasks: Task[]; announcements: Announcement[] }) => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get all events for the current month
    const getMonthlyEvents = () => {
        const events: Array<{
            date: string;
            type: 'task' | 'meeting' | 'deadline' | 'announcement';
            title: string;
            priority?: string;
            category?: string;
        }> = [];

        // Add tasks with due dates in this month
        tasks.forEach(task => {
            const taskDate = new Date(task.dueDate);
            if (taskDate.getMonth() === month && taskDate.getFullYear() === year && task.status !== 'completed') {
                events.push({
                    date: task.dueDate,
                    type: 'task',
                    title: task.title,
                    priority: task.priority,
                    category: task.category
                });
            }
        });

        // Add announcements in this month
        announcements.forEach(ann => {
            const annDate = new Date(ann.date);
            if (annDate.getMonth() === month && annDate.getFullYear() === year) {
                events.push({
                    date: ann.date,
                    type: ann.type === 'meeting' ? 'meeting' : ann.type === 'deadline' ? 'deadline' : 'announcement',
                    title: ann.title
                });
            }
        });

        // Sort by date
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return events;
    };

    const monthlyEvents = getMonthlyEvents();
    const today = new Date().toISOString().split('T')[0];

    // Filter for upcoming and important events
    const upcomingEvents = monthlyEvents.filter(e => e.date >= today);
    const importantEvents = upcomingEvents.filter(e =>
        e.type === 'deadline' || e.type === 'meeting' || e.priority === 'high'
    );

    const getEventIcon = (type: string, priority?: string) => {
        if (type === 'meeting') return <Users size={14} className="text-blue-400" />;
        if (type === 'deadline') return <AlertTriangle size={14} className="text-red-400" />;
        if (priority === 'high') return <AlertTriangle size={14} className="text-orange-400" />;
        return <ListTodo size={14} className="text-green-400" />;
    };

    const getEventColor = (type: string, priority?: string) => {
        if (type === 'meeting') return 'border-l-blue-400 bg-blue-500/5';
        if (type === 'deadline') return 'border-l-red-400 bg-red-500/5';
        if (priority === 'high') return 'border-l-orange-400 bg-orange-500/5';
        return 'border-l-green-400 bg-green-500/5';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (dateStr === today.toISOString().split('T')[0]) return 'Today';
        if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    };

    return (
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle size={16} className="text-yellow-400" />
                    Important This Month
                </h3>
                <span className="text-xs text-white/50 font-mono">
                    {importantEvents.length} upcoming
                </span>
            </div>

            {importantEvents.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400/50" />
                    No urgent events this month
                </div>
            ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {importantEvents.slice(0, 8).map((event, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`border-l-2 rounded-r-lg px-4 py-3 ${getEventColor(event.type, event.priority)}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    {getEventIcon(event.type, event.priority)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{event.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-white/50 text-xs">{formatDate(event.date)}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium ${event.type === 'meeting' ? 'bg-blue-500/20 text-blue-400' :
                                            event.type === 'deadline' ? 'bg-red-500/20 text-red-400' :
                                                event.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-green-500/20 text-green-400'
                                            }`}>
                                            {event.type === 'task' ? event.priority : event.type}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    {importantEvents.length > 8 && (
                        <div className="text-center text-white/50 text-xs py-2">
                            +{importantEvents.length - 8} more events
                        </div>
                    )}
                </div>
            )}

            {/* Quick Stats */}
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3">
                <div className="text-center">
                    <p className="text-blue-400 font-bold text-lg">{monthlyEvents.filter(e => e.type === 'meeting').length}</p>
                    <p className="text-white/50 text-xs">Meetings</p>
                </div>
                <div className="text-center">
                    <p className="text-red-400 font-bold text-lg">{monthlyEvents.filter(e => e.type === 'deadline').length}</p>
                    <p className="text-white/50 text-xs">Deadlines</p>
                </div>
                <div className="text-center">
                    <p className="text-orange-400 font-bold text-lg">{monthlyEvents.filter(e => e.priority === 'high').length}</p>
                    <p className="text-white/50 text-xs">High Priority</p>
                </div>
            </div>
        </div>
    );
};

// Calendar Widget Component
const CalendarWidget = ({ tasks, announcements }: { tasks: Task[]; announcements: Announcement[] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and total days
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Create calendar grid
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

    // Get events for a specific date
    const getEventsForDate = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const events: Array<{ type: 'task' | 'meeting' | 'deadline' | 'announcement'; title: string; priority?: string }> = [];

        // Add tasks with due dates
        tasks.forEach(task => {
            if (task.dueDate === dateStr) {
                events.push({
                    type: 'task',
                    title: task.title,
                    priority: task.priority
                });
            }
        });

        // Add announcements (meetings, deadlines)
        announcements.forEach(ann => {
            if (ann.date === dateStr) {
                events.push({
                    type: ann.type === 'meeting' ? 'meeting' : ann.type === 'deadline' ? 'deadline' : 'announcement',
                    title: ann.title
                });
            }
        });

        return events;
    };

    // Check if a day has events
    const hasEvents = (day: number) => getEventsForDate(day).length > 0;

    // Get event indicator colors
    const getEventIndicators = (day: number) => {
        const events = getEventsForDate(day);
        const indicators: string[] = [];

        if (events.some(e => e.type === 'meeting')) indicators.push('bg-blue-400');
        if (events.some(e => e.type === 'deadline')) indicators.push('bg-red-400');
        if (events.some(e => e.type === 'task' && e.priority === 'high')) indicators.push('bg-orange-400');
        if (events.some(e => e.type === 'task' && e.priority !== 'high')) indicators.push('bg-green-400');
        if (events.some(e => e.type === 'announcement')) indicators.push('bg-purple-400');

        return indicators.slice(0, 3); // Max 3 indicators
    };

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDate(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDate(null);
    };

    const handleDateClick = (day: number) => {
        if (hasEvents(day)) {
            setSelectedDate(new Date(year, month, day));
        } else {
            setSelectedDate(null);
        }
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="space-y-2">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                    <ChevronRight size={14} className="rotate-180" />
                </button>
                <span className="text-white font-medium text-sm">
                    {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                    <ChevronRight size={14} />
                </button>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-0.5">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-white/40 text-[10px] font-medium py-1">
                        {day.charAt(0)}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, index) => (
                    <div
                        key={index}
                        onClick={() => day && handleDateClick(day)}
                        className={`
                            h-8 w-8 flex flex-col items-center justify-center rounded text-xs relative
                            ${day ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}
                            ${day && isToday(day) ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400 font-bold' : 'text-white/70'}
                            ${day && selectedDate?.getDate() === day ? 'bg-white/10 ring-1 ring-blue-500/50' : ''}
                        `}
                    >
                        {day && (
                            <>
                                <span className="text-[11px]">{day}</span>
                                {hasEvents(day) && (
                                    <div className="flex gap-px absolute bottom-0.5">
                                        {getEventIndicators(day).map((color, i) => (
                                            <span key={i} className={`w-1 h-1 rounded-full ${color}`}></span>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span className="text-white/50 text-[10px]">Meeting</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    <span className="text-white/50 text-[10px]">Deadline</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    <span className="text-white/50 text-[10px]">High</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    <span className="text-white/50 text-[10px]">Task</span>
                </div>
            </div>

            {/* Selected Date Events */}
            <AnimatePresence>
                {selectedDate && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white/5 rounded-lg p-3 space-y-2">
                            <h3 className="text-white font-medium text-xs flex items-center gap-2">
                                <Calendar size={12} className="text-blue-400" />
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </h3>
                            <div className="space-y-1.5">
                                {getEventsForDate(selectedDate.getDate()).map((event, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 text-xs"
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${event.type === 'meeting' ? 'bg-blue-400' :
                                            event.type === 'deadline' ? 'bg-red-400' :
                                                event.priority === 'high' ? 'bg-orange-400' : 'bg-green-400'
                                            }`}></span>
                                        <div className="flex-1">
                                            <p className="text-white/80 text-xs">{event.title}</p>
                                            <span className="text-white/40 text-[10px] capitalize">
                                                {event.type === 'task' ? `${event.priority}` : event.type}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Tasks Tab
const TasksTab = ({
    tasks,
    title,
    currentMember,
    onAddTask,
    onDeleteTask,
    onUpdateTask
}: {
    tasks: Task[];
    title: string;
    currentMember?: Member;
    onAddTask?: (task: Task) => void;
    onDeleteTask?: (id: string) => void;
    onUpdateTask?: (id: string, status: 'pending' | 'in-progress' | 'completed') => void;
}) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
    const [isUpdating, setIsUpdating] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [activePanel, setActivePanel] = useState<'menu' | 'details' | 'edit' | 'delete' | null>(null);
    const [editStatus, setEditStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');

    // Add Task Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [newTaskCategory, setNewTaskCategory] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');

    const isCouncil = currentMember?.clearance === 5;
    const categories = ['Technical', 'Documentation', 'Design', 'Meeting', 'Research', 'Training', 'Procurement', 'Admin', 'Other'];

    const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

    const toggleMenu = (taskId: string) => {
        if (expandedTaskId === taskId && activePanel === 'menu') {
            setExpandedTaskId(null);
            setActivePanel(null);
        } else {
            setExpandedTaskId(taskId);
            setActivePanel('menu');
        }
    };

    const showDetails = (task: Task) => {
        setExpandedTaskId(task.id);
        setActivePanel('details');
    };

    const showEdit = (task: Task) => {
        setEditStatus(task.status);
        setExpandedTaskId(task.id);
        setActivePanel('edit');
    };

    const showDelete = (taskId: string) => {
        setExpandedTaskId(taskId);
        setActivePanel('delete');
    };

    const closePanel = () => {
        setExpandedTaskId(null);
        setActivePanel(null);
    };

    const resetAddForm = () => {
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('medium');
        setNewTaskCategory('');
        setNewTaskDueDate('');
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);

        // Create new task
        const newTask: Task = {
            id: String(Date.now()), // Use timestamp as temporary ID
            title: newTaskTitle,
            status: 'pending',
            priority: newTaskPriority,
            dueDate: newTaskDueDate,
            assignedBy: 'Self',
            category: newTaskCategory,
            description: newTaskDescription,
        };

        if (onAddTask) {
            onAddTask(newTask);
        }
        resetAddForm();
        setShowAddForm(false);
        setSuccessMessage('Task added successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        setIsUpdating(false);
    };

    const handleUpdateStatus = async (task: Task) => {
        setIsUpdating(true);

        if (onUpdateTask) {
            onUpdateTask(task.id, editStatus);
        }

        closePanel();
        setSuccessMessage('Task status updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        setIsUpdating(false);
    };

    const handleConfirmDelete = async (taskId: string) => {
        setIsUpdating(true);

        if (onDeleteTask) {
            onDeleteTask(taskId);
        }

        closePanel();
        setSuccessMessage('Task deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        setIsUpdating(false);
    };

    return (
        // Mobile: Reduced spacing (space-y-4) for higher density, desktop unchanged
        <div className="space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-4">
                <h1 className="text-xl lg:text-2xl font-bold text-white">{title}</h1>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center justify-center gap-2 px-3 lg:px-4 py-2 text-white rounded-lg text-xs lg:text-sm font-medium transition-colors ${showAddForm ? 'bg-red-500 hover:bg-red-400' : 'bg-blue-500 hover:bg-blue-400'
                        }`}
                >
                    {showAddForm ? <X size={14} className="lg:w-4 lg:h-4" /> : <Plus size={14} className="lg:w-4 lg:h-4" />}
                    {showAddForm ? 'Cancel' : 'Add Task'}
                </button>
            </div>

            {/* Add Task Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleAddTask} className="bg-gray-800/50 rounded-xl border border-white/10 p-5 space-y-4">
                            <h3 className="text-white font-medium flex items-center gap-2">
                                <Plus size={18} className="text-blue-400" />
                                Add New Task
                            </h3>

                            {/* Task Title */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Task Title *
                                </label>
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="Enter task title..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newTaskDescription}
                                    onChange={(e) => setNewTaskDescription(e.target.value)}
                                    placeholder="Add more details..."
                                    rows={2}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                                />
                            </div>

                            {/* Priority, Category, Due Date */}
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Priority *
                                    </label>
                                    <select
                                        value={newTaskPriority}
                                        onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Category *
                                    </label>
                                    <select
                                        value={newTaskCategory}
                                        onChange={(e) => setNewTaskCategory(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                        required
                                    >
                                        <option value="">Select...</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={newTaskDueDate}
                                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isUpdating}
                                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUpdating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Plus size={18} />
                                        Add Task
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-green-400"
                    >
                        <CheckCircle2 size={18} />
                        {successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters - Mobile: Reduced padding for compact look */}
            <div className="flex gap-1.5 lg:gap-2 flex-wrap">
                {['all', 'pending', 'in-progress', 'completed'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as typeof filter)}
                        className={`px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all ${filter === f
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                    </button>
                ))}
            </div>

            {/* Tasks List - Mobile: Reduced spacing and padding */}
            <div className="space-y-2 lg:space-y-3">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-8 lg:py-12 bg-gray-800/30 rounded-lg lg:rounded-xl border border-white/5">
                        <ListTodo size={36} className="lg:w-12 lg:h-12 text-white/20 mx-auto mb-3 lg:mb-4" />
                        <p className="text-white/40 text-sm">No tasks found</p>
                    </div>
                ) : (
                    filteredTasks.map((task, index) => (
                        <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-gray-800/30 rounded-lg lg:rounded-xl p-3 lg:p-5 border border-white/5 hover:border-white/10 transition-all"
                        >
                            <div className="flex items-start gap-4">
                                <div className="mt-1">{getStatusIcon(task.status)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3
                                            className={`text-white font-medium cursor-pointer hover:text-blue-400 transition-colors ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
                                            onClick={() => showDetails(task)}
                                        >
                                            {task.title}
                                        </h3>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMenu(task.id);
                                            }}
                                            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${expandedTaskId === task.id
                                                ? 'text-blue-400 bg-blue-500/10'
                                                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                                                }`}
                                        >
                                            {expandedTaskId === task.id ? <X size={18} /> : <MoreVertical size={18} />}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                        <span className={`text-[10px] px-2 py-1 rounded-full border font-medium uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </span>
                                        <span className="text-white/40 text-xs flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                        <span className="text-white/40 text-xs">
                                            Category: <span className="text-white/60">{task.category}</span>
                                        </span>
                                        <span className="text-white/40 text-xs">
                                            From: <span className="text-white/60">{task.assignedBy}</span>
                                        </span>
                                    </div>

                                    {/* Expandable Panels */}
                                    <AnimatePresence>
                                        {expandedTaskId === task.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                {/* Action Menu */}
                                                {activePanel === 'menu' && (
                                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                                                        <button
                                                            onClick={() => showDetails(task)}
                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                        >
                                                            <Eye size={16} />
                                                            View Details
                                                        </button>
                                                        <button
                                                            onClick={() => showEdit(task)}
                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                        >
                                                            <Edit3 size={16} />
                                                            Edit Status
                                                        </button>
                                                        {(isCouncil || task.assignedBy === 'Self') && (
                                                            <button
                                                                onClick={() => showDelete(task.id)}
                                                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Details Panel */}
                                                {activePanel === 'details' && (
                                                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-white font-medium flex items-center gap-2">
                                                                <Eye size={16} className="text-blue-400" />
                                                                Task Details
                                                            </h4>
                                                            <button
                                                                onClick={() => setActivePanel('menu')}
                                                                className="text-xs text-white/40 hover:text-white/60 transition-colors"
                                                            >
                                                                ← Back
                                                            </button>
                                                        </div>

                                                        <div className="bg-white/5 rounded-lg p-4 space-y-3">
                                                            <div>
                                                                <label className="text-white/40 text-xs uppercase tracking-wider">Description</label>
                                                                <p className="text-white/70 mt-1 text-sm">
                                                                    {(task as any).description || 'No description provided'}
                                                                </p>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-white/40 text-xs uppercase tracking-wider">Status</label>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {getStatusIcon(task.status)}
                                                                        <span className="text-white text-sm capitalize">{task.status.replace('-', ' ')}</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-white/40 text-xs uppercase tracking-wider">Priority</label>
                                                                    <p className={`mt-1 text-sm font-medium capitalize ${task.priority === 'high' ? 'text-red-400' :
                                                                        task.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
                                                                        }`}>{task.priority}</p>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-white/40 text-xs uppercase tracking-wider">Due Date</label>
                                                                    <p className="text-white text-sm mt-1">{new Date(task.dueDate).toLocaleDateString()}</p>
                                                                </div>
                                                                <div>
                                                                    <label className="text-white/40 text-xs uppercase tracking-wider">Category</label>
                                                                    <p className="text-white text-sm mt-1">{task.category}</p>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-white/40 text-xs uppercase tracking-wider">Assigned By</label>
                                                                <p className="text-white text-sm mt-1">{task.assignedBy}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => showEdit(task)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                            >
                                                                <Edit3 size={16} />
                                                                Edit Status
                                                            </button>
                                                            <button
                                                                onClick={closePanel}
                                                                className="flex-1 px-3 py-2 text-sm text-white/60 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                            >
                                                                Close
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Edit Status Panel */}
                                                {activePanel === 'edit' && (
                                                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-white font-medium flex items-center gap-2">
                                                                <Edit3 size={16} className="text-blue-400" />
                                                                Edit Status
                                                            </h4>
                                                            <button
                                                                onClick={() => setActivePanel('menu')}
                                                                className="text-xs text-white/40 hover:text-white/60 transition-colors"
                                                            >
                                                                ← Back
                                                            </button>
                                                        </div>

                                                        <div className="space-y-2">
                                                            {['pending', 'in-progress', 'completed'].map((status) => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => setEditStatus(status as typeof editStatus)}
                                                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${editStatus === status
                                                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                                                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                                                                        }`}
                                                                >
                                                                    {getStatusIcon(status)}
                                                                    <span className="capitalize">{status.replace('-', ' ')}</span>
                                                                </button>
                                                            ))}
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleUpdateStatus(task)}
                                                                disabled={isUpdating}
                                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                {isUpdating ? (
                                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 size={16} />
                                                                        Update
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={closePanel}
                                                                className="flex-1 px-3 py-2 text-sm text-white/60 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Delete Confirmation Panel */}
                                                {activePanel === 'delete' && (
                                                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                                <Trash2 size={20} className="text-red-400" />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-medium">Delete Task?</h4>
                                                                <p className="text-white/50 text-sm">This action cannot be undone</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleConfirmDelete(task.id)}
                                                                disabled={isUpdating}
                                                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-red-500 hover:bg-red-400 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                {isUpdating ? (
                                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <>
                                                                        <Trash2 size={16} />
                                                                        Delete
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setActivePanel('menu')}
                                                                className="flex-1 px-3 py-2 text-sm text-white/60 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

// Admin Report Dashboard - ONLY for UDAAN-000 Super Admin
// Read-only overview of all tasks, announcements, and activity logs
const AdminReportTab = ({ currentMember }: { currentMember: Member }) => {
    const [tasks, setTasks] = useState<SupabaseTask[]>([]);
    const [announcements, setAnnouncements] = useState<SupabaseAnnouncement[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'announcements' | 'activity'>('overview');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { getAllTasks, getAnnouncements, getAllActivityLogs, getActiveMembers, getAlumniMembers } = await import('../utils/supabase');

                const [allTasks, allAnnouncements, logs, activeMembers, alumni] = await Promise.all([
                    getAllTasks(),
                    getAnnouncements(), // This fetches all announcements
                    getAllActivityLogs(50),
                    getActiveMembers(),
                    getAlumniMembers()
                ]);

                setTasks(allTasks);
                setAnnouncements(allAnnouncements);
                setActivityLogs(logs);
                setMembers([...activeMembers, ...alumni] as Member[]);
            } catch (error) {
                // Error handled silently
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    // Only super admin can access this
    if (currentMember.member_id !== 'UDAAN-000') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-white/50">
                <AlertCircle size={48} className="mb-4" />
                <p>Access Denied</p>
                <p className="text-sm">Only UDAAN-000 can access admin reports.</p>
            </div>
        );
    }

    // Statistics
    const taskStats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
    };

    const memberStats = {
        total: members.length,
        council: members.filter(m => m.clearance >= 5 && m.member_id !== 'UDAAN-000').length,
        regular: members.filter(m => m.clearance > 0 && m.clearance < 5).length,
        alumni: members.filter(m => m.year === 0 || m.role === 'Alumni').length,
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-2xl p-6 border border-red-500/20">
                <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <BarChart3 size={28} className="text-red-400" />
                    Admin Report Dashboard
                </h1>
                <p className="text-white/60">
                    Read-only overview of all system activity. Data refreshed on page load.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg">
                {[
                    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
                    { id: 'tasks', label: 'All Tasks', icon: <ListTodo size={16} /> },
                    { id: 'announcements', label: 'Announcements', icon: <Bell size={16} /> },
                    { id: 'activity', label: 'Activity Log', icon: <Clock size={16} /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 text-sm ${activeTab === tab.id
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-white/50 hover:text-white/70'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                            <p className="text-white/50 text-xs uppercase tracking-wider">Total Members</p>
                            <p className="text-3xl font-bold text-white mt-1">{memberStats.total}</p>
                            <p className="text-white/40 text-xs mt-1">
                                {memberStats.council} council • {memberStats.regular} members • {memberStats.alumni} alumni
                            </p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                            <p className="text-white/50 text-xs uppercase tracking-wider">Total Tasks</p>
                            <p className="text-3xl font-bold text-white mt-1">{taskStats.total}</p>
                            <p className="text-white/40 text-xs mt-1">
                                {taskStats.pending} pending • {taskStats.inProgress} in progress
                            </p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                            <p className="text-white/50 text-xs uppercase tracking-wider">Completed Tasks</p>
                            <p className="text-3xl font-bold text-green-400 mt-1">{taskStats.completed}</p>
                            <p className="text-white/40 text-xs mt-1">
                                {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% completion rate
                            </p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                            <p className="text-white/50 text-xs uppercase tracking-wider">Announcements</p>
                            <p className="text-3xl font-bold text-blue-400 mt-1">{announcements.length}</p>
                            <p className="text-white/40 text-xs mt-1">
                                {announcements.filter(a => new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week
                            </p>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                            <Clock size={16} className="text-white/50" />
                            Recent Activity
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {activityLogs.slice(0, 10).map((log, index) => (
                                <div key={index} className="text-sm flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white/70 truncate">{log.details || log.action}</p>
                                        <p className="text-white/30 text-xs">
                                            {log.member_name} • {new Date(log.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <ListTodo size={16} className="text-white/50" />
                        All Tasks ({tasks.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {tasks.length === 0 ? (
                            <p className="text-white/40 text-center py-8">No tasks found</p>
                        ) : (
                            tasks.map((task) => (
                                <div key={task.id} className="p-3 bg-black/20 rounded-lg border border-white/5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{task.title}</p>
                                            <p className="text-white/40 text-xs truncate">{task.description}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                            task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                                        <span>Assigned to: {task.assigned_to}</span>
                                        <span>By: {task.assigned_by_name}</span>
                                        <span>Priority: {task.priority}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Announcements Tab */}
            {activeTab === 'announcements' && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <Bell size={16} className="text-white/50" />
                        All Announcements ({announcements.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {announcements.length === 0 ? (
                            <p className="text-white/40 text-center py-8">No announcements found</p>
                        ) : (
                            announcements.map((ann) => (
                                <div key={ann.id} className="p-3 bg-black/20 rounded-lg border border-white/5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium">{ann.title}</p>
                                            <p className="text-white/40 text-xs line-clamp-2">{ann.content}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${ann.type === 'important' ? 'bg-red-500/20 text-red-400' :
                                            ann.type === 'deadline' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {ann.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                                        <span>By: {ann.created_by_name}</span>
                                        <span>Type: {ann.type}</span>
                                        <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Activity Log Tab */}
            {activeTab === 'activity' && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <Clock size={16} className="text-white/50" />
                        Activity Log ({activityLogs.length} recent entries)
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {activityLogs.length === 0 ? (
                            <p className="text-white/40 text-center py-8">No activity logs found</p>
                        ) : (
                            activityLogs.map((log, index) => (
                                <div key={index} className="p-3 bg-black/20 rounded-lg border border-white/5">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.action.includes('create') || log.action.includes('add') ? 'bg-green-500/20 text-green-400' :
                                            log.action.includes('delete') || log.action.includes('remove') ? 'bg-red-500/20 text-red-400' :
                                                log.action.includes('update') || log.action.includes('edit') ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-white/10 text-white/50'
                                            }`}>
                                            {log.action.includes('create') || log.action.includes('add') ? <Plus size={14} /> :
                                                log.action.includes('delete') || log.action.includes('remove') ? <Trash2 size={14} /> :
                                                    <Edit3 size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white/70">{log.details || log.action}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-white/30">
                                                <span>{log.member_name}</span>
                                                <span>•</span>
                                                <span>{log.member_id}</span>
                                                <span>•</span>
                                                <span>{new Date(log.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Council Transfer Tab - ONLY for UDAAN-000 Super Admin
// This handles the yearly council transfer with ID migrations
// 
// COUNCIL ROLE ASSIGNMENT ORDER (STRICT):
// 1. President
// 2. Vice President
// 3. Creative Head
// 4. Management Lead & Treasurer
// 5. Drone Lead
// 6. RC Lead
// 7. Rocket Lead
// 8. Secretary (FINAL STEP - designation, not separate position)
//
// Secretary eligibility: Creative Head, Management Lead & Treasurer, Drone Lead, RC Lead, Rocket Lead
// Secretary CANNOT be: President or Vice President

// Council position definitions with FIXED order (7 positions + Secretary designation)
const COUNCIL_POSITIONS = [
    { id: 'president', label: 'President', order: 1, icon: Shield, color: 'text-yellow-400', secretaryEligible: false },
    { id: 'vice_president', label: 'Vice President', order: 2, icon: Star, color: 'text-blue-400', secretaryEligible: false },
    { id: 'creative_head', label: 'Creative Head', order: 3, icon: Scroll, color: 'text-purple-400', secretaryEligible: true },
    { id: 'management_lead', label: 'Management Lead & Treasurer', order: 4, icon: Briefcase, color: 'text-pink-400', secretaryEligible: true },
    { id: 'drone_lead', label: 'Drone Lead', order: 5, icon: Hexagon, color: 'text-cyan-400', secretaryEligible: true },
    { id: 'rc_lead', label: 'RC Lead', order: 6, icon: Plane, color: 'text-green-400', secretaryEligible: true },
    { id: 'rocket_lead', label: 'Rocket Lead', order: 7, icon: Rocket, color: 'text-orange-400', secretaryEligible: true },
] as const;

// Secretary is a DESIGNATION assigned to one of the eligible council members (not a separate position)
// This is step 8 in the flow - must be assigned LAST after all 7 positions are filled

type CouncilPositionId = typeof COUNCIL_POSITIONS[number]['id'];

interface RoleAssignment {
    memberId: string;
    memberName: string;
    position: CouncilPositionId;
    currentYear: number;
    newYear: number;
    isSecretary?: boolean; // Secretary designation (additional to main position)
}

const CouncilTransferTab = ({ currentMember }: { currentMember: Member }) => {
    // UPDATED: Council is now selected from 2nd year members (not 3rd year)
    const [secondYearMembers, setSecondYearMembers] = useState<SupabaseMember[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransferring, setIsTransferring] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);
    const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null);

    // NEW: Role assignment state - maps member ID to council position
    const [roleAssignments, setRoleAssignments] = useState<Record<string, CouncilPositionId>>({});
    // NEW: Current step in role assignment flow (0 = selection, 1-7 = role assignment, 8 = secretary designation)
    const [assignmentStep, setAssignmentStep] = useState(0);
    // NEW: Show preview before final confirmation
    const [showPreview, setShowPreview] = useState(false);
    // NEW: Secretary designation (member ID who will also be Secretary)
    const [secretaryId, setSecretaryId] = useState<string | null>(null);

    // UPDATED: Fetch 2nd year members eligible for council (changed from 3rd year)
    useEffect(() => {
        const fetchEligibleMembers = async () => {
            setIsLoading(true);
            try {
                const members = await getActiveMembers();
                // UPDATED: Filter only 2nd year non-council members (changed from 3rd year)
                const eligible = members.filter(m =>
                    m.year === 2 &&
                    m.clearance < 5 &&
                    m.role !== 'Alumni' &&
                    !isSuperAdmin(m.member_id)
                );
                setSecondYearMembers(eligible);
            } catch (error) {
                console.error('Error fetching eligible members:', error);
            }
            setIsLoading(false);
        };
        fetchEligibleMembers();
    }, []);

    // Maximum council members allowed
    const MAX_COUNCIL_MEMBERS = 7;

    const toggleMemberSelection = (memberId: string) => {
        setSelectedMembers(prev => {
            // If already selected, allow deselection
            if (prev.includes(memberId)) {
                return prev.filter(id => id !== memberId);
            }
            // If at max limit, don't allow more selections
            if (prev.length >= MAX_COUNCIL_MEMBERS) {
                return prev;
            }
            return [...prev, memberId];
        });
        // Reset role assignments when selection changes
        setRoleAssignments({});
        setSecretaryId(null);
        setAssignmentStep(0);
        setShowPreview(false);
    };

    // NEW: Assign a role to a member
    const assignRole = (memberId: string, position: CouncilPositionId) => {
        setRoleAssignments(prev => {
            const updated = { ...prev };
            // Remove any existing assignment for this position
            Object.keys(updated).forEach(key => {
                if (updated[key] === position) {
                    delete updated[key];
                }
            });
            // Assign the new role
            updated[memberId] = position;
            return updated;
        });
        // Reset secretary if reassigning roles
        setSecretaryId(null);
    };

    // NEW: Get members eligible for Secretary DESIGNATION
    // Secretary CAN be: Creative Head, Management Lead & Treasurer, Drone Lead, RC Lead, Rocket Lead
    // Secretary CANNOT be: President or Vice President
    const getSecretaryEligibleMembers = () => {
        // Get IDs of President and VP (they cannot be Secretary)
        const presidentId = Object.keys(roleAssignments).find(id => roleAssignments[id] === 'president');
        const vpId = Object.keys(roleAssignments).find(id => roleAssignments[id] === 'vice_president');

        // Return member objects for eligible members (not President/VP)
        return selectedMembers
            .filter(id => id !== presidentId && id !== vpId)
            .map(id => {
                const member = secondYearMembers.find(m => m.member_id === id);
                return { id, name: member?.name || 'Unknown' };
            });
    };

    // NEW: Check if all required roles are assigned
    // VALIDATION RULES:
    // 1. All 7 positions must be assigned (President, VP, Creative Head, Management Lead, Drone Lead, RC Lead, Rocket Lead)
    // 2. Secretary designation must be assigned to one of the 5 eligible members
    // 3. Secretary cannot be President or Vice President
    // 4. Each position can only be assigned to one member
    const validateRoleAssignments = (): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        const assignedPositions = Object.values(roleAssignments);

        // All 7 positions must be assigned
        COUNCIL_POSITIONS.forEach(pos => {
            if (!assignedPositions.includes(pos.id)) {
                errors.push(`${pos.label} must be assigned`);
            }
        });

        // Secretary designation must be assigned
        if (!secretaryId) {
            errors.push('Secretary must be designated from eligible council members');
        }

        // Secretary cannot be President or VP (extra safety check)
        const presidentMemberId = Object.keys(roleAssignments).find(id => roleAssignments[id] === 'president');
        const vpMemberId = Object.keys(roleAssignments).find(id => roleAssignments[id] === 'vice_president');

        if (secretaryId && (secretaryId === presidentMemberId || secretaryId === vpMemberId)) {
            errors.push('Secretary cannot be President or Vice President');
        }

        // Secretary must be from eligible positions (Creative Head, Management Lead, Drone Lead, RC Lead, Rocket Lead)
        if (secretaryId) {
            const secretaryPosition = roleAssignments[secretaryId];
            const eligiblePositions = COUNCIL_POSITIONS.filter(p => p.secretaryEligible).map(p => p.id);
            if (!eligiblePositions.includes(secretaryPosition)) {
                errors.push('Secretary must be Creative Head, Management Lead, Drone Lead, RC Lead, or Rocket Lead');
            }
        }

        // Check for duplicate assignments (member assigned to multiple positions)
        const memberIds = Object.keys(roleAssignments);
        const uniqueMembers = new Set(memberIds);
        if (memberIds.length !== uniqueMembers.size) {
            errors.push('A member cannot hold multiple positions');
        }

        return { valid: errors.length === 0, errors };
    };

    // NEW: Get position label for a member (including Secretary designation)
    const getMemberPosition = (memberId: string): string => {
        const positionId = roleAssignments[memberId];
        if (!positionId) return 'Council Member';
        const position = COUNCIL_POSITIONS.find(p => p.id === positionId);
        const baseLabel = position?.label || 'Council Member';
        // Add Secretary designation if applicable
        if (memberId === secretaryId) {
            return `${baseLabel} & Secretary`;
        }
        return baseLabel;
    };

    // NEW: Get the transfer preview data
    const getTransferPreview = (): RoleAssignment[] => {
        return selectedMembers.map(memberId => {
            const member = secondYearMembers.find(m => m.member_id === memberId);
            const position = roleAssignments[memberId];
            return {
                memberId,
                memberName: member?.name || 'Unknown',
                position: position || COUNCIL_POSITIONS[0].id,
                currentYear: 2,
                newYear: 3,
                isSecretary: memberId === secretaryId,
            };
        }).sort((a, b) => {
            const orderA = COUNCIL_POSITIONS.find(p => p.id === a.position)?.order || 99;
            const orderB = COUNCIL_POSITIONS.find(p => p.id === b.position)?.order || 99;
            return orderA - orderB;
        });
    };

    // NEW: Proceed to role assignment after member selection
    // Council requires exactly 7 members for all positions
    const proceedToRoleAssignment = () => {
        if (selectedMembers.length !== MAX_COUNCIL_MEMBERS) {
            setTransferResult({ success: false, message: `Select exactly ${MAX_COUNCIL_MEMBERS} members for all council positions` });
            return;
        }
        setAssignmentStep(1);
        setTransferResult(null);
    };

    // NEW: Move to next assignment step
    // FLOW: Steps 1-7 = Position assignment, Step 8 = Secretary designation
    const nextAssignmentStep = () => {
        // Steps 1-7: Position assignment
        if (assignmentStep >= 1 && assignmentStep <= COUNCIL_POSITIONS.length) {
            const currentPosition = COUNCIL_POSITIONS[assignmentStep - 1];
            if (currentPosition) {
                const hasAssignment = Object.values(roleAssignments).includes(currentPosition.id);
                // All positions are mandatory
                if (!hasAssignment) {
                    setTransferResult({ success: false, message: `${currentPosition.label} must be assigned before proceeding` });
                    return;
                }
            }
        }

        // After step 7 (all positions assigned), move to step 8 (Secretary designation)
        if (assignmentStep === COUNCIL_POSITIONS.length) {
            setAssignmentStep(8); // Secretary designation step
            setTransferResult(null);
            return;
        }

        // Step 8: Secretary designation - validate and show preview
        if (assignmentStep === 8) {
            if (!secretaryId) {
                setTransferResult({ success: false, message: 'Secretary must be designated from eligible council members' });
                return;
            }
            const validation = validateRoleAssignments();
            if (!validation.valid) {
                setTransferResult({ success: false, message: validation.errors.join('. ') });
                return;
            }
            setShowPreview(true);
            setTransferResult(null);
            return;
        }

        setAssignmentStep(prev => prev + 1);
        setTransferResult(null);
    };

    // NEW: Go back to previous step
    const prevAssignmentStep = () => {
        if (showPreview) {
            setShowPreview(false);
            return;
        }
        if (assignmentStep === 8) {
            // Go back to last position step
            setAssignmentStep(COUNCIL_POSITIONS.length);
            return;
        }
        if (assignmentStep > 0) {
            setAssignmentStep(prev => prev - 1);
        }
        setTransferResult(null);
    };

    const handleTransfer = async () => {
        if (!isSuperAdmin(currentMember.member_id)) {
            setTransferResult({ success: false, message: 'Only UDAAN-000 can perform council transfer' });
            return;
        }

        if (selectedMembers.length !== MAX_COUNCIL_MEMBERS) {
            setTransferResult({ success: false, message: `Please select exactly ${MAX_COUNCIL_MEMBERS} members for the new council` });
            return;
        }

        // Validate role assignments before transfer
        const validation = validateRoleAssignments();
        if (!validation.valid) {
            setTransferResult({ success: false, message: validation.errors.join('. ') });
            return;
        }

        setIsTransferring(true);
        try {
            // Pass role assignments AND secretary designation to the transfer function
            const result = await transferCouncil(currentMember.member_id, selectedMembers, roleAssignments, secretaryId);
            setTransferResult(result);
            if (result.success) {
                setSelectedMembers([]);
                setRoleAssignments({});
                setSecretaryId(null);
                setAssignmentStep(0);
                setShowPreview(false);
                setConfirmTransfer(false);
                // UPDATED: Refresh the eligible members list (2nd year, not 3rd year)
                const members = await getActiveMembers();
                const eligible = members.filter(m =>
                    m.year === 2 &&
                    m.clearance < 5 &&
                    m.role !== 'Alumni' &&
                    !isSuperAdmin(m.member_id)
                );
                setSecondYearMembers(eligible);
            }
        } catch (error: any) {
            setTransferResult({ success: false, message: error.message || 'Transfer failed' });
        }
        setIsTransferring(false);
    };

    // Only super admin can access this
    if (!isSuperAdmin(currentMember.member_id)) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-white/50">
                <AlertCircle size={48} className="mb-4" />
                <p>Access Denied</p>
                <p className="text-sm">Only UDAAN-000 can access council transfer.</p>
            </div>
        );
    }

    // Get current position being assigned
    const currentPositionConfig = assignmentStep > 0 && assignmentStep <= COUNCIL_POSITIONS.length
        ? COUNCIL_POSITIONS[assignmentStep - 1]
        : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-6 border border-yellow-500/20">
                <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <Crown size={28} className="text-yellow-400" />
                    Council Transfer
                </h1>
                <p className="text-white/60">
                    Transfer council authority to new members. This action will:
                </p>
                <ul className="text-white/50 text-sm mt-2 space-y-1 ml-4 list-disc">
                    <li>Selected 2nd years → New Council + 3rd year (UDAAN-00X)</li>
                    <li>Non-selected 2nd years → 3rd year (UDAAN-20XX → UDAAN-30XX)</li>
                    <li>3rd years → 4th year (UDAAN-30XX → UDAAN-40XX)</li>
                    <li>1st years → 2nd year (UDAAN-10XX → UDAAN-20XX)</li>
                    <li>4th years → Alumni (A-000X format)</li>
                </ul>
            </div>

            {/* Role Assignment Order Info */}
            {assignmentStep > 0 && !showPreview && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-blue-400 font-bold mb-2">📋 Role Assignment Order (7 Positions + Secretary)</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {COUNCIL_POSITIONS.map((pos, idx) => {
                            const IconComponent = pos.icon;
                            const isComplete = Object.values(roleAssignments).includes(pos.id);
                            const isCurrent = assignmentStep === idx + 1;
                            return (
                                <div
                                    key={pos.id}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono ${isCurrent ? 'bg-white/20 ring-2 ring-white/50' :
                                        isComplete ? 'bg-green-500/20 text-green-400' :
                                            'bg-white/5 text-white/40'
                                        }`}
                                >
                                    <IconComponent size={12} />
                                    <span>{pos.label.length > 15 ? pos.label.split(' ')[0] : pos.label}</span>
                                    {isComplete && <Check size={12} className="text-green-400" />}
                                </div>
                            );
                        })}
                        {/* Secretary designation indicator */}
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono ${assignmentStep === 8 ? 'bg-white/20 ring-2 ring-white/50' :
                                secretaryId ? 'bg-green-500/20 text-green-400' :
                                    'bg-white/5 text-white/40'
                                }`}
                        >
                            <Award size={12} />
                            <span>Secretary</span>
                            {secretaryId && <Check size={12} className="text-green-400" />}
                        </div>
                    </div>
                    <p className="text-white/40 text-xs">
                        ⚠️ Secretary is a designation assigned to one of: Creative Head, Management Lead, Drone Lead, RC Lead, or Rocket Lead
                    </p>
                </div>
            )}

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-red-400 flex-shrink-0 mt-1" size={20} />
                <div>
                    <p className="text-red-400 font-bold">⚠️ Critical Action</p>
                    <p className="text-white/60 text-sm">
                        This action is irreversible and affects ALL members. Member IDs, years, and roles will be permanently updated.
                        Ensure you have a database backup before proceeding.
                    </p>
                </div>
            </div>

            {/* Transfer Result */}
            {transferResult && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${transferResult.success
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                    {transferResult.success ? (
                        <CheckCircle2 className="text-green-400 flex-shrink-0 mt-1" size={20} />
                    ) : (
                        <AlertCircle className="text-red-400 flex-shrink-0 mt-1" size={20} />
                    )}
                    <p className={transferResult.success ? 'text-green-400' : 'text-red-400'}>
                        {transferResult.message}
                    </p>
                </div>
            )}

            {/* STEP 0: Select New Council Members */}
            {assignmentStep === 0 && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users size={20} className="text-blue-400" />
                        Step 1: Select New Council Members
                    </h2>
                    <p className="text-white/50 text-sm mb-4">
                        Select exactly {MAX_COUNCIL_MEMBERS} second-year members for the council positions: President, Vice President, Creative Head, Management Lead, Drone Lead, RC Lead, Rocket Lead.
                    </p>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        </div>
                    ) : secondYearMembers.length === 0 ? (
                        <div className="text-center py-8 text-white/40">
                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No eligible 2nd year members found</p>
                        </div>
                    ) : (
                        <div
                            className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                            style={{
                                overflowY: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-y',
                                scrollBehavior: 'smooth'
                            }}
                            onWheel={(e) => {
                                e.stopPropagation();
                                const target = e.currentTarget;
                                target.scrollTop += e.deltaY;
                            }}
                        >
                            {secondYearMembers.map((m, index) => {
                                const isSelected = selectedMembers.includes(m.member_id);
                                const isDisabled = !isSelected && selectedMembers.length >= MAX_COUNCIL_MEMBERS;
                                return (
                                    <button
                                        key={m.member_id}
                                        onClick={() => toggleMemberSelection(m.member_id)}
                                        disabled={isDisabled}
                                        className={`p-4 rounded-lg border transition-all text-left ${isSelected
                                            ? 'bg-blue-500/20 border-blue-500/50'
                                            : isDisabled
                                                ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                                                : 'bg-white/5 border-white/10 hover:border-white/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 text-white/50'
                                                }`}>
                                                {isSelected ? (
                                                    <Check size={16} />
                                                ) : (
                                                    <span>{index + 1}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">{m.name}</p>
                                                <p className="text-white/40 text-xs">{m.member_id} • {m.division}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {selectedMembers.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 flex items-center justify-between">
                            <p className="text-blue-400 text-sm">
                                <strong>{selectedMembers.length}</strong>/{MAX_COUNCIL_MEMBERS} member{selectedMembers.length > 1 ? 's' : ''} selected
                            </p>
                            <button
                                onClick={proceedToRoleAssignment}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
                            >
                                Assign Roles <ArrowRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* STEPS 1-7: Role Assignment (Positions) */}
            {assignmentStep >= 1 && assignmentStep <= COUNCIL_POSITIONS.length && !showPreview && currentPositionConfig && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        {React.createElement(currentPositionConfig.icon, { size: 20, className: currentPositionConfig.color })}
                        Step {assignmentStep}: Assign {currentPositionConfig.label}
                    </h2>

                    {/* Secretary eligibility indicator */}
                    {currentPositionConfig.secretaryEligible && (
                        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                            <p className="text-purple-400 text-sm flex items-center gap-2">
                                <FileText size={14} />
                                <span>This position is <strong>eligible</strong> for Secretary designation (assigned in Step 8)</span>
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                        {/* Show all selected members for position assignment */}
                        {selectedMembers.map(memberId => {
                            const member = secondYearMembers.find(m => m.member_id === memberId);
                            const currentAssignment = roleAssignments[memberId];
                            const isSelected = currentAssignment === currentPositionConfig.id;
                            const isAssignedElsewhere = currentAssignment && currentAssignment !== currentPositionConfig.id;

                            return (
                                <button
                                    key={memberId}
                                    onClick={() => !isAssignedElsewhere && assignRole(memberId, currentPositionConfig.id)}
                                    disabled={isAssignedElsewhere}
                                    className={`p-4 rounded-lg border transition-all text-left ${isSelected
                                        ? `bg-gradient-to-r from-${currentPositionConfig.color.replace('text-', '')}/20 to-transparent border-${currentPositionConfig.color.replace('text-', '')}/50`
                                        : isAssignedElsewhere
                                            ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                                            : 'bg-white/5 border-white/10 hover:border-white/30'
                                        } ${isSelected ? 'ring-2 ring-white/30' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected
                                            ? 'bg-white text-gray-900'
                                            : 'bg-white/10 text-white/50'
                                            }`}>
                                            {isSelected ? <Check size={16} /> : React.createElement(currentPositionConfig.icon, { size: 16 })}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{member?.name}</p>
                                            <p className="text-white/40 text-xs">
                                                {isAssignedElsewhere
                                                    ? `Already assigned as ${getMemberPosition(memberId)}`
                                                    : `${member?.division}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Navigation */}
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={prevAssignmentStep}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <button
                            onClick={nextAssignmentStep}
                            className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {assignmentStep === COUNCIL_POSITIONS.length ? 'Secretary Selection' : 'Next'} <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 8: Secretary Designation */}
            {assignmentStep === COUNCIL_POSITIONS.length + 1 && !showPreview && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-purple-400" />
                        Step 8: Designate Secretary
                    </h2>

                    <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-purple-400 text-sm">
                            <strong>Secretary Designation:</strong> Select one council member from the eligible positions below.
                            The Secretary is a <em>designation</em> in addition to their primary position, not a separate role.
                        </p>
                    </div>

                    <p className="text-white/50 text-sm mb-4">
                        Eligible members (positions other than President/VP):
                    </p>

                    {/* Eligible Members Grid */}
                    <div className="grid gap-3">
                        {getSecretaryEligibleMembers().map((member) => {
                            const memberPosition = roleAssignments[member.id];
                            const posConfig = COUNCIL_POSITIONS.find(p => p.id === memberPosition);
                            const isSelected = secretaryId === member.id;

                            return (
                                <button
                                    key={member.id}
                                    onClick={() => setSecretaryId(isSelected ? null : member.id)}
                                    className={`p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                        ? 'border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50'
                                        : 'border-white/10 bg-black/20 hover:bg-black/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-purple-500/30' : 'bg-white/10'
                                            }`}>
                                            {posConfig && React.createElement(posConfig.icon, {
                                                size: 20,
                                                className: isSelected ? 'text-purple-400' : posConfig.color
                                            })}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{member.name}</p>
                                            <p className={`text-smnow it is  ${posConfig?.color || 'text-white/40'}`}>
                                                {posConfig?.label || 'Member'}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="flex items-center gap-2 text-purple-400">
                                                <FileText size={16} />
                                                <span className="text-sm font-medium">Secretary</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Navigation */}
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={prevAssignmentStep}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <button
                            onClick={nextAssignmentStep}
                            disabled={!secretaryId}
                            className={`flex-1 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${secretaryId
                                ? 'bg-green-500 hover:bg-green-400 text-white'
                                : 'bg-white/10 text-white/40 cursor-not-allowed'
                                }`}
                        >
                            Preview <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* PREVIEW: Show all assignments before final confirmation */}
            {showPreview && (
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Eye size={20} className="text-green-400" />
                        Council Transfer Preview
                    </h2>
                    <p className="text-white/50 text-sm mb-4">
                        Review the following assignments before confirming the transfer:
                    </p>

                    {/* Transfer Preview Table */}
                    <div className="bg-black/30 rounded-lg border border-white/10 overflow-hidden mb-6">
                        <div className="grid grid-cols-4 gap-2 p-3 bg-white/5 text-xs font-mono text-white/60 uppercase tracking-wider">
                            <span>Member</span>
                            <span>Year Change</span>
                            <span>New ID</span>
                            <span>Position</span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {getTransferPreview().map((assignment, idx) => {
                                const posConfig = COUNCIL_POSITIONS.find(p => p.id === assignment.position);
                                const IconComponent = posConfig?.icon || Users;
                                const isSecretary = assignment.memberId === secretaryId;
                                return (
                                    <div key={assignment.memberId} className="grid grid-cols-4 gap-2 p-3 items-center">
                                        <span className="text-white font-medium truncate">{assignment.memberName}</span>
                                        <span className="text-white/60 text-sm">
                                            {assignment.currentYear}nd Year → {assignment.newYear}rd Year
                                        </span>
                                        <span className="text-blue-400 font-mono text-sm">
                                            UDAAN-{String(idx + 1).padStart(3, '0')}
                                        </span>
                                        <div className="flex flex-col gap-1">
                                            <span className={`flex items-center gap-1.5 ${posConfig?.color || 'text-white'}`}>
                                                <IconComponent size={14} />
                                                <span className="text-sm font-medium">{posConfig?.label || 'Member'}</span>
                                            </span>
                                            {isSecretary && (
                                                <span className="flex items-center gap-1.5 text-purple-400">
                                                    <FileText size={12} />
                                                    <span className="text-xs font-medium">+ Secretary</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Validation Summary */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
                            <CheckCircle2 size={16} />
                            Validation Passed
                        </div>
                        <ul className="text-white/60 text-sm space-y-1 ml-6 list-disc">
                            <li>President assigned: ✓</li>
                            <li>Vice President assigned: ✓</li>
                            <li>All 7 positions assigned: ✓</li>
                            <li>Secretary designated (not President/VP): ✓</li>
                            <li>No duplicate assignments: ✓</li>
                        </ul>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3">
                        <button
                            onClick={prevAssignmentStep}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} /> Back to Edit
                        </button>
                        <button
                            onClick={() => setConfirmTransfer(true)}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Crown size={16} /> Initiate Transfer
                        </button>
                    </div>
                </div>
            )}

            {/* Final Confirmation Modal */}
            {confirmTransfer && (
                <div className="bg-gray-800/50 rounded-xl border border-red-500/30 p-6">
                    <div className="space-y-4">
                        <p className="text-white text-center text-lg font-bold">
                            ⚠️ Final Confirmation Required
                        </p>
                        <p className="text-white/60 text-center text-sm">
                            You are about to transfer council authority to {selectedMembers.length} new members.
                            This action will update ALL member IDs, years, and roles permanently.
                        </p>
                        <p className="text-red-400 text-center text-sm font-mono">
                            This action cannot be undone!
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmTransfer(false)}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors"
                                disabled={isTransferring}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={isTransferring}
                                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isTransferring ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Transferring...
                                    </>
                                ) : (
                                    <>
                                        <Crown size={20} />
                                        Confirm Transfer
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ID Card Tab
const IDCardTab = ({ member }: { member: Member }) => {
    const currentDate = new Date();
    const validUntil = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());

    // Photo upload state
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Photo positioning state (drag and zoom)
    const [photoPosition, setPhotoPosition] = useState({ x: 0, y: 0 });
    const [photoZoom, setPhotoZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoContainerRef = useRef<HTMLDivElement>(null);

    // Check if photo upload is allowed (1-year lock, alumni/admin restrictions)
    const photoUploadStatus = canUploadPhoto(member);

    // Accepted input formats (user-friendly)
    const acceptedFormats = '.png,.jpg,.jpeg,.webp';
    const maxFileSize = 5 * 1024 * 1024; // 5MB max

    // Handle file selection with validation
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError('');

        // Validate file type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setUploadError('Invalid format. Please upload PNG, JPG, JPEG, or WebP.');
            return;
        }

        // Validate file size
        if (file.size > maxFileSize) {
            setUploadError('File too large. Maximum size is 5MB.');
            return;
        }

        setSelectedFile(file);

        // Create preview URL using FileReader (more reliable than createObjectURL)
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                setPreviewUrl(result);
                // Reset positioning
                setPhotoPosition({ x: 0, y: 0 });
                setPhotoZoom(1);
                // Show modal for positioning
                setShowPhotoModal(true);
            }
        };
        reader.onerror = () => {
            setUploadError('Failed to read file. Please try again.');
        };
        reader.readAsDataURL(file);
    };

    // Convert image to WebP using canvas (client-side conversion)
    // Preview container is 144x176 (w-36 h-44), canvas is 2x for retina
    const PREVIEW_WIDTH = 144;
    const PREVIEW_HEIGHT = 176;

    const convertToWebP = async (imageDataUrl: string, position: { x: number; y: number }, zoom: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas with ID card photo dimensions (2x for retina)
                const canvas = document.createElement('canvas');
                const targetWidth = PREVIEW_WIDTH * 2; // 288
                const targetHeight = PREVIEW_HEIGHT * 2; // 352
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                // Fill with background
                ctx.fillStyle = '#1f2937';
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                // Calculate base scale to fit within container (like object-fit: contain)
                // This matches the preview behavior
                const scaleX = PREVIEW_WIDTH / img.width;
                const scaleY = PREVIEW_HEIGHT / img.height;
                const baseScale = Math.min(scaleX, scaleY); // Contain, not cover

                // Apply user's zoom on top of base scale
                const finalScale = baseScale * zoom;

                // Calculate scaled dimensions (multiply by 2 for retina)
                const scaledWidth = img.width * finalScale * 2;
                const scaledHeight = img.height * finalScale * 2;

                // Center the image, then apply user's position offset (scaled for retina)
                const offsetX = (targetWidth - scaledWidth) / 2 + position.x * 2;
                const offsetY = (targetHeight - scaledHeight) / 2 + position.y * 2;

                // Draw image with positioning
                ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                // Convert to WebP (only WebP stored)
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to convert to WebP'));
                        }
                    },
                    'image/webp',
                    0.85 // Quality 85% for good balance
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            // Use the data URL directly instead of creating a new object URL
            img.src = imageDataUrl;
        });
    };

    // Handle photo upload with WebP conversion
    const handlePhotoUpload = async () => {
        if (!previewUrl) return;

        setIsUploading(true);
        setUploadError('');

        try {
            // Convert to WebP with positioning (mandatory conversion)
            const webpBlob = await convertToWebP(previewUrl, photoPosition, photoZoom);

            // Upload to Supabase
            const { uploadMemberPhoto } = await import('../utils/supabase');
            const result = await uploadMemberPhoto(member.member_id, webpBlob);

            if (result.success && result.url) {
                setUploadSuccess(true);
                setShowPhotoModal(false);

                // Update session storage with new photo URL before reload
                const savedData = sessionStorage.getItem('udaanMemberData');
                if (savedData) {
                    try {
                        const memberData = JSON.parse(savedData);
                        memberData.profile_pic = result.url;
                        memberData.photo_uploaded_at = new Date().toISOString();
                        sessionStorage.setItem('udaanMemberData', JSON.stringify(memberData));
                    } catch (e) { }
                }

                // Reload to show new photo
                setTimeout(() => window.location.reload(), 1500);
            } else if (result.success) {
                // URL not returned but upload succeeded
                setUploadSuccess(true);
                setShowPhotoModal(false);
                // Force re-login by clearing session
                sessionStorage.removeItem('udaanMemberData');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setUploadError(result.error || 'Upload failed');
            }
        } catch (err) {
            setUploadError('Failed to process image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Photo drag handlers for positioning
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - photoPosition.x, y: e.clientY - photoPosition.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPhotoPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Cleanup preview URL on unmount (not needed for data URLs, but kept for safety)
    useEffect(() => {
        return () => {
            // Data URLs don't need revoking, but clear state
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // UDAAN-000 (Super Admin) should not have an ID card
    if (member.member_id === 'UDAAN-000') {
        return (
            <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-bold text-white mb-6">Digital ID Card</h1>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-red-900/20 to-red-800/10 rounded-2xl border border-red-500/30 p-8 text-center"
                >
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Shield size={40} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">System Administrator</h2>
                    <p className="text-white/60 mb-4">UDAAN-000</p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                        <p className="text-white/50 text-sm">
                            The System Administrator account does not have a visible ID card, QR code, or division information.
                        </p>
                        <p className="text-white/40 text-xs mt-2">
                            This account exists for administrative purposes only and is not displayed in team views.
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Alumni should not have an ID card (restricted access)
    if (member.role === 'Alumni' || member.clearance === 0) {
        return (
            <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-bold text-white mb-6">Digital ID Card</h1>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-2xl border border-white/10 p-8 text-center"
                >
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                        <User size={40} className="text-white/30" />
                    </div>
                    <h2 className="text-xl font-bold text-white/50 mb-2">Alumni Member</h2>
                    <p className="text-white/40 mb-4">{member.member_id}</p>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                        <p className="text-white/40 text-sm">
                            Alumni members do not have active ID cards.
                        </p>
                        <p className="text-white/30 text-xs mt-2">
                            Thank you for your contributions to UDAAN.
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-6">Digital ID Card</h1>

            {/* Hidden file input for photo upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFormats}
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Success message */}
            <AnimatePresence>
                {uploadSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-4 bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-green-400"
                    >
                        <CheckCircle2 size={18} />
                        Photo uploaded successfully! Refreshing...
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            >
                {/* Header Strip */}
                <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 p-5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiLz48cGF0aCBkPSJNMjAgMjBMMCA0MGg0MFYwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <img src="/udaan-logo.webp" alt="" className="w-14 h-14 object-contain drop-shadow-lg flex-shrink-0" />
                            <div className="min-w-0">
                                <h1 className="text-white font-bold text-2xl tracking-wider whitespace-nowrap">UDAAN</h1>
                                <p className="text-white/70 text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">NIT Rourkela</p>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-white/60 text-[10px] uppercase tracking-wider whitespace-nowrap">Member ID</p>
                            <p className="text-white font-mono font-bold text-lg whitespace-nowrap">{member.member_id}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-8">
                    <div className="flex gap-8">
                        {/* Photo area with upload functionality */}
                        <div
                            className={`w-36 h-44 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 border-2 ${photoUploadStatus.allowed ? 'border-white/10 hover:border-blue-500/50 cursor-pointer' : 'border-white/10'} flex items-center justify-center flex-shrink-0 relative overflow-hidden group transition-all`}
                            onClick={() => photoUploadStatus.allowed && fileInputRef.current?.click()}
                        >
                            {/* Show existing photo or placeholder */}
                            {member.profile_pic ? (
                                <img
                                    src={member.profile_pic}
                                    alt={member.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent"></div>
                                    <div className="text-white/30">{getIcon(member.icon, 50)}</div>
                                </>
                            )}

                            {/* Upload overlay - only shown if upload is allowed */}
                            {photoUploadStatus.allowed && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                    <Camera size={24} className="text-white/80 mb-1" />
                                    <p className="text-[10px] text-white/60 uppercase tracking-wider">
                                        {member.profile_pic ? 'Change' : 'Upload'}
                                    </p>
                                </div>
                            )}

                            {/* Bottom label */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1.5 text-center">
                                {photoUploadStatus.allowed ? (
                                    <p className="text-[10px] text-white/60 uppercase tracking-wider">
                                        {member.profile_pic ? 'Photo' : 'Click to Upload'}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">
                                        {photoUploadStatus.daysRemaining ? `Locked ${photoUploadStatus.daysRemaining}d` : 'Photo'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex-1">
                            <h2 className="text-white text-2xl font-bold uppercase tracking-wide mb-2">{formatName(member.name)}</h2>
                            <p className="text-blue-400 text-base font-semibold uppercase tracking-wider mb-5">{member.role}</p>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-white/40 text-xs uppercase tracking-wider w-20">Division</span>
                                    <span className="text-white/80 text-sm font-mono">{member.division}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-white/40 text-xs uppercase tracking-wider w-20">Clearance</span>
                                    <div className="flex gap-1.5">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`w-4 h-4 rounded-sm ${i < member.clearance ? 'bg-blue-500' : 'bg-gray-700'}`} />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-white/40 text-xs uppercase tracking-wider w-20">Status</span>
                                    <span className="text-green-400 text-sm font-mono flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
                                        ACTIVE
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Additional Details Section */}
                    <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-4">
                        {member.roll_no && (
                            <div className="flex items-center gap-3">
                                <Hash size={16} className="text-white/40" />
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Roll Number</p>
                                    <p className="text-white/80 text-sm font-mono">{member.roll_no}</p>
                                </div>
                            </div>
                        )}
                        {member.department && (
                            <div className="flex items-center gap-3">
                                <Briefcase size={16} className="text-white/40" />
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Department</p>
                                    <p className="text-white/80 text-sm font-mono">{member.department}</p>
                                </div>
                            </div>
                        )}
                        {member.phone && (
                            <div className="flex items-center gap-3">
                                <Phone size={16} className="text-white/40" />
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Phone</p>
                                    <p className="text-white/80 text-sm font-mono">{member.phone}</p>
                                </div>
                            </div>
                        )}
                        {member.institute_email && (
                            <div className="flex items-center gap-3">
                                <Mail size={16} className="text-white/40" />
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Institute Email</p>
                                    <p className="text-white/80 text-sm font-mono truncate max-w-[180px]">{member.institute_email}</p>
                                </div>
                            </div>
                        )}
                        {member.personal_email && member.email_verified && (
                            <div className="flex items-center gap-3 col-span-2">
                                <CheckCircle2 size={16} className="text-green-400" />
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Verified Email</p>
                                    <p className="text-white/80 text-sm font-mono">{member.personal_email}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <QrCode size={50} className="text-white/20" />
                            <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-wider">Valid Until</p>
                                <p className="text-white/60 text-sm font-mono">{validUntil.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Technical Society</p>
                            <p className="text-white/60 text-sm font-mono">SAC • NITR</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 px-8 py-4 flex items-center justify-between">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Aeromodelling Club</p>
                    <div className="flex gap-1">
                        {[...Array(25)].map((_, i) => (
                            <div key={i} className={`w-0.5 ${i % 3 === 0 ? 'h-5' : 'h-3'} bg-white/20`}></div>
                        ))}
                    </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>
            </motion.div>

            <p className="text-center text-white/30 text-xs mt-6 font-mono uppercase tracking-wider">
                <Shield size={12} className="inline mr-1" />
                Official Udaan Member Identification
            </p>

            {/* Photo Upload/Positioning Modal */}
            <AnimatePresence>
                {showPhotoModal && previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => !isUploading && setShowPhotoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-white/10 rounded-xl p-4 sm:p-6 max-w-md w-full my-auto max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Camera size={20} className="text-blue-400" />
                                Position Your Photo
                            </h3>

                            {/* Preview area with drag functionality */}
                            <div
                                ref={photoContainerRef}
                                className="w-36 h-44 mx-auto rounded-lg bg-gray-800 border-2 border-white/20 overflow-hidden relative cursor-move mb-4"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    setIsDragging(true);
                                    setDragStart({ x: touch.clientX - photoPosition.x, y: touch.clientY - photoPosition.y });
                                }}
                                onTouchMove={(e) => {
                                    if (!isDragging) return;
                                    const touch = e.touches[0];
                                    setPhotoPosition({
                                        x: touch.clientX - dragStart.x,
                                        y: touch.clientY - dragStart.y
                                    });
                                }}
                                onTouchEnd={() => setIsDragging(false)}
                            >
                                {previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="absolute select-none pointer-events-none"
                                        draggable={false}
                                        style={{
                                            left: '50%',
                                            top: '50%',
                                            transform: `translate(-50%, -50%) translate(${photoPosition.x}px, ${photoPosition.y}px) scale(${photoZoom})`,
                                            transformOrigin: 'center center',
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            width: 'auto',
                                            height: 'auto',
                                            objectFit: 'contain'
                                        }}
                                    />
                                )}
                                {/* Frame overlay */}
                                <div className="absolute inset-0 border-2 border-dashed border-white/30 pointer-events-none"></div>
                            </div>

                            <p className="text-white/50 text-xs text-center mb-4">
                                Drag to position • Use slider to zoom
                            </p>

                            {/* Zoom slider */}
                            <div className="mb-4">
                                <label className="text-white/60 text-xs uppercase tracking-wider mb-2 block">
                                    Zoom: {Math.round(photoZoom * 100)}%
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.05"
                                    value={photoZoom}
                                    onChange={(e) => setPhotoZoom(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Reset position button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setPhotoPosition({ x: 0, y: 0 });
                                    setPhotoZoom(1);
                                }}
                                className="w-full mb-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-sm transition-colors"
                            >
                                Reset Position
                            </button>

                            {/* Error message */}
                            {uploadError && (
                                <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                                    {uploadError}
                                </div>
                            )}

                            {/* 1-year lock notice */}
                            <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                                <p className="text-yellow-400/80 text-xs">
                                    <AlertTriangle size={12} className="inline mr-1" />
                                    Once uploaded, your photo cannot be changed for 365 days.
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPhotoModal(false);
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                    }}
                                    disabled={isUploading}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePhotoUpload}
                                    disabled={isUploading}
                                    className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Upload Photo
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ==========================================
// INDUCTION APPROVALS TAB (New Feature)
// ==========================================
const InductionApprovalsTab = () => {
    const [provisionalMembers, setProvisionalMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'All' | 'Drone' | 'RC Plane' | 'Rocketry' | 'Management' | 'Creative/Web-Dev'>('All');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [confirmDivisions, setConfirmDivisions] = useState<string[]>([]);
    const [isApproving, setIsApproving] = useState(false);

    // Fetch provisional members
    const fetchProvisional = async () => {
        setIsLoading(true);
        try {
            const { getProvisionalMembers } = await import('../utils/supabase');
            const members = await getProvisionalMembers();
            // Map to include icon (required by Member interface in this file)
            const membersWithIcon = members.map(m => ({
                ...m,
                icon: 'user'
            }));
            setProvisionalMembers(membersWithIcon);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProvisional();
    }, []);

    // Helper to filter - normalize tab labels to stored interest IDs
    // Stored IDs: 'drone', 'rcplane', 'rocketry', 'creative', 'management'
    // Tab labels: 'Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'
    const tabToStoredId: { [key: string]: string[] } = {
        'Drone': ['drone'],
        'RC Plane': ['rcplane', 'rc plane', 'rc'],
        'Rocketry': ['rocketry', 'rocket'],
        'Management': ['management'],
        'Creative/Web-Dev': ['creative', 'web', 'web-dev']
    };

    const filteredMembers = activeTab === 'All'
        ? provisionalMembers
        : provisionalMembers.filter(m => {
            const memberDivs = (m.division || '').toLowerCase();
            const searchTerms = tabToStoredId[activeTab] || [activeTab.toLowerCase()];
            // Check if any of the search terms match in the member's divisions
            return searchTerms.some(term => memberDivs.includes(term));
        });

    const handleApproveClick = (member: Member) => {
        setSelectedMember(member);

        // Determine initial selection based on context
        // If viewing from "Drone" tab, pre-select only "Drone".
        // If viewing from "All" tab, allow approving all requested divisions.
        let initialSelection: string[] = [];

        if (activeTab !== 'All') {
            initialSelection = [activeTab];
        } else {
            // Default to all user's divisions if in "All" tab
            const rawDivs = member.division?.split(',') || [];
            // Map raw strings to proper Display Names
            const displayMap: { [key: string]: string } = {
                'drone': 'Drone',
                'rc plane': 'RC Plane',
                'rcplane': 'RC Plane',
                'rocketry': 'Rocketry',
                'rocket': 'Rocketry',
                'management': 'Management',
                'creative': 'Creative/Web-Dev',
                'web-dev': 'Creative/Web-Dev'
            };

            initialSelection = rawDivs
                .map(d => d.trim().toLowerCase())
                .map(d => displayMap[d] || d) // Normalize
                // Filter to only valid tabs
                .filter(d => ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'].includes(d));

            // Dedupe
            initialSelection = [...new Set(initialSelection)];

            // Fallback if empty logic (e.g. invalid string)
            if (initialSelection.length === 0) initialSelection = ['Drone'];
        }

        setConfirmDivisions(initialSelection);
    };

    const confirmApproval = async () => {
        if (!selectedMember || confirmDivisions.length === 0) return;
        setIsApproving(true);
        try {
            const { approveProvisionalMember } = await import('../utils/supabase');
            // Join selected divisions with comma
            const divisionsString = confirmDivisions.join(', ');
            const result = await approveProvisionalMember(selectedMember.member_id, divisionsString);
            if (result.success) {
                alert(result.message);
                setProvisionalMembers(prev => prev.filter(m => m.member_id !== selectedMember.member_id));
                setSelectedMember(null);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (err) {
            console.error(err);
            alert('An unexpected error occurred.');
        } finally {
            setIsApproving(false);
        }
    };

    const toggleDivision = (div: string) => {
        setConfirmDivisions(prev => {
            if (prev.includes(div)) {
                return prev.filter(d => d !== div);
            } else {
                return [...prev, div];
            }
        });
    };

    if (isLoading) return <div className="p-8 text-center text-white/50">Loading provisional members...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-2xl p-6 border border-green-500/20">
                <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <UserPlus size={28} className="text-green-400" />
                    Induction Approvals
                </h1>
                <p className="text-white/60">
                    Review and approve provisional members. Approved members get <b>Level 2 Clearance</b> and are added to the club roster.
                </p>
            </div>

            {/* Division Filter Tabs */}
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg overflow-x-auto">
                {['All', 'Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'].map(div => (
                    <button
                        key={div}
                        onClick={() => setActiveTab(div as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === div
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'text-white/50 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        {div}
                    </button>
                ))}
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-xl">
                        No provisional members found in this category.
                    </div>
                ) : (
                    filteredMembers.map(member => (
                        <div key={member.member_id} className="bg-gray-800/40 border border-white/10 rounded-xl p-4 flex flex-col gap-3 group hover:border-green-500/30 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 text-white flex items-center justify-center font-bold text-sm">
                                        {formatFirstName(member.name).substring(0, 2)}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">{member.name}</h3>
                                        <p className="text-xs text-white/40 font-mono">{member.member_id}</p>
                                    </div>
                                </div>
                                <div className="px-2 py-1 rounded text-[10px] font-mono uppercase bg-white/5 text-white/40">
                                    {member.division || 'General'}
                                </div>
                            </div>

                            <div className="text-xs text-white/50 space-y-1 bg-black/20 p-2 rounded-lg">
                                <div className="flex justify-between">
                                    <span>Email:</span>
                                    <span className="text-white/70">{member.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Joined:</span>
                                    <span className="text-white/70">{new Date(member.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleApproveClick(member)}
                                className="mt-auto w-full py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <UserPlus size={16} /> Approve & Add
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Approval Modal */}
            {selectedMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setSelectedMember(null)}
                            className="absolute top-4 right-4 text-white/40 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2">Confirm Approval</h2>
                        <p className="text-white/60 text-sm mb-6">
                            You are about to approve <b>{selectedMember.name}</b>.
                            Select the subsystems they are approved for:
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-white/40 uppercase mb-2">Assign Subsystem(s)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Only show subsystems the candidate selected */}
                                    {(() => {
                                        // Map stored IDs to display labels
                                        const idToLabel: { [key: string]: string } = {
                                            'drone': 'Drone',
                                            'rcplane': 'RC Plane',
                                            'rc plane': 'RC Plane',
                                            'rocketry': 'Rocketry',
                                            'rocket': 'Rocketry',
                                            'management': 'Management',
                                            'creative': 'Creative/Web-Dev',
                                            'web-dev': 'Creative/Web-Dev',
                                            'web': 'Creative/Web-Dev'
                                        };

                                        // Parse member's divisions and get unique display labels
                                        const rawDivs = (selectedMember.division || '').split(',').map(d => d.trim().toLowerCase());
                                        const displayLabels = [...new Set(rawDivs.map(d => idToLabel[d]).filter(Boolean))];

                                        // Fallback if no valid divisions found
                                        if (displayLabels.length === 0) {
                                            return <p className="text-white/40 text-xs col-span-2">No subsystems selected by candidate.</p>;
                                        }

                                        return displayLabels.map(div => {
                                            const isSelected = confirmDivisions.includes(div);
                                            return (
                                                <button
                                                    key={div}
                                                    onClick={() => toggleDivision(div)}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${isSelected
                                                        ? 'bg-green-500/20 border-green-500 text-green-400'
                                                        : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {div}
                                                    {isSelected && <CheckCircle2 size={12} />}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex gap-3">
                                <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-200/80">
                                    They will be added to the rosters of the selected subsystems only.
                                </p>
                            </div>

                            <button
                                onClick={confirmApproval}
                                disabled={isApproving || confirmDivisions.length === 0}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {isApproving ? 'Processing...' : 'Confirm & Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Team Tab - now fetches from Supabase
const TeamTab = ({ currentMember }: { currentMember?: Member }) => {
    const [teamMembers, setTeamMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDiv, setActiveDiv] = useState('all');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; member: Member | null }>({ show: false, member: null });
    const [isDeleting, setIsDeleting] = useState(false);
    const [togglingInactive, setTogglingInactive] = useState<string | null>(null);

    // Add state for edit modal
    const [editMember, setEditMember] = useState<Member | null>(null);
    const [editYear, setEditYear] = useState('');
    const [editDivision, setEditDivision] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    const isCouncil = currentMember?.clearance === 5;
    const superAdmin = currentMember ? isSuperAdmin(currentMember.member_id) : false;
    const canToggleInactive = isCouncil || superAdmin;

    // Helper function to calculate days since inactive
    const getDaysInactive = (inactiveSince: string | undefined): number => {
        if (!inactiveSince) return 0;
        const inactiveDate = new Date(inactiveSince);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - inactiveDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Handle toggle inactive status
    const handleToggleInactive = async (member: Member) => {
        if (!currentMember || !canToggleInactive) return;

        setTogglingInactive(member.member_id);
        const result = await toggleMemberInactiveStatus(member.member_id, currentMember.member_id);

        if (result.success && result.member) {
            // Update member in local state
            setTeamMembers(prev => prev.map(m =>
                m.member_id === member.member_id
                    ? { ...m, is_inactive: result.member!.is_inactive, inactive_since: result.member!.inactive_since, icon: m.icon }
                    : m
            ));
            setDetailsOpen(null); // Close the menu after successful toggle
        } else {
            console.error('Failed to toggle inactive status:', result.message);
            alert(result.message || 'Failed to update status. Make sure the database migration has been run.');
        }
        setTogglingInactive(null);
    };

    const divisions = [
        { id: 'all', label: 'All', icon: <Users size={16} /> },
        { id: 'executive', label: 'Executive Body', icon: <Award size={16} /> },
        { id: 'drone', label: 'Drone Subsystem', icon: <Hexagon size={16} /> },
        { id: 'rc', label: 'RC Subsystem', icon: <Plane size={16} /> },
        { id: 'rocket', label: 'Rocketry', icon: <Rocket size={16} /> },
        { id: 'management', label: 'Management Team', icon: <Briefcase size={16} /> },
        { id: 'creative', label: 'Creative/Web-Dev', icon: <Scroll size={16} /> },
    ];

    // Map member to divisions (can belong to multiple)
    const getMemberDivisions = (member: Member): string[] => {
        const role = member.role.toLowerCase();
        const division = member.division || '';
        const divisionLower = division.toLowerCase();
        const divisionsList: string[] = [];

        // Only council members (clearance 5) are in Executive Body
        if (member.clearance >= 5) {
            divisionsList.push('executive');
        }

        // Map division field from database to filter categories
        // Handle comma-separated divisions (e.g., "Rocketry, Creative/Web-Dev, Drone")
        // These match the values from AddMemberTab: 'Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'
        if (divisionLower.includes('drone')) {
            divisionsList.push('drone');
        }
        if (divisionLower.includes('rc') || divisionLower.includes('plane')) {
            divisionsList.push('rc');
        }
        if (divisionLower.includes('rocket')) {
            divisionsList.push('rocket');
        }
        if (divisionLower.includes('management')) {
            divisionsList.push('management');
        }
        if (divisionLower.includes('creative') || divisionLower.includes('web')) {
            divisionsList.push('creative');
        }

        // Also check role for additional context (for council members who may have subsystem roles)
        if (role.includes('drone') && !divisionsList.includes('drone')) divisionsList.push('drone');
        if ((role.includes('plane') || role.includes('rc')) && !divisionsList.includes('rc')) divisionsList.push('rc');
        if (role.includes('rocket') && !divisionsList.includes('rocket')) divisionsList.push('rocket');
        if ((role.includes('management') || role.includes('treasurer')) && !divisionsList.includes('management')) divisionsList.push('management');
        if ((role.includes('creative') || role.includes('web') || role.includes('design')) && !divisionsList.includes('creative')) divisionsList.push('creative');

        return [...new Set(divisionsList)]; // Remove duplicates
    };

    // Get primary division for badge display
    const getPrimaryDivision = (member: Member): string => {
        const divs = getMemberDivisions(member);
        // Prioritize non-executive for display if member has multiple
        const nonExec = divs.find(d => d !== 'executive');
        return nonExec || 'executive';
    };

    // Get member year from database field
    const getMemberYear = (member: Member): number => {
        // Use year field from database, default to 2 if not set
        return member.year || 2;
    };

    useEffect(() => {
        const fetchMembers = async () => {
            const members = await getMembers();
            // Sort by year (descending - 4th year first, then 3rd, then 2nd) then by role importance
            const sortedMembers = members
                .map(m => ({
                    ...m,
                    icon: getRoleIcon(m.role)
                }))
                .sort((a, b) => {
                    // First sort by year (descending)
                    const yearA = a.year || 2;
                    const yearB = b.year || 2;
                    if (yearB !== yearA) return yearB - yearA;
                    // Then by role hierarchy
                    const roleOrder = (role: string): number => {
                        const r = role.toLowerCase();
                        if (r.includes('president') && !r.includes('vice')) return 1;
                        if (r.includes('vice president')) return 2;
                        if (r.includes('secretary')) return 3;
                        if (r.includes('treasurer') || r.includes('management lead')) return 4;
                        if (r.includes('lead')) return 5;
                        return 10;
                    };
                    return roleOrder(a.role) - roleOrder(b.role);
                });
            setTeamMembers(sortedMembers);
            setLoading(false);
        };
        fetchMembers();
    }, []);

    const handleDeleteMember = async (member: Member) => {
        setIsDeleting(true);
        const result = await removeMemberCompletely(member.member_id);
        if (result.success) {
            setTeamMembers(prev => prev.filter(m => m.member_id !== member.member_id));
        }
        setDeleteConfirm({ show: false, member: null });
        setIsDeleting(false);
    };

    const canDeleteMember = (member: Member): boolean => {
        // Only council can delete, and cannot delete other council members
        return isCouncil && member.clearance < 5;
    };

    // DEFENSIVE: First filter out any provisional members that might have leaked through
    // Primary filtering is in getMembers() query - this is a safety net
    const approvedMembers = teamMembers.filter(m => m.status === undefined || m.status === 'approved');

    const filteredMembers = activeDiv === 'all'
        ? approvedMembers
        : approvedMembers.filter(m => getMemberDivisions(m).includes(activeDiv));

    // Get clearance label
    const getClearanceLabel = (clearance: number): string => {
        switch (clearance) {
            case 5: return 'Council';
            case 4: return '4th Year';
            case 3: return 'Regular';
            case 1: return '1st Year';
            default: return 'Member';
        }
    };

    const getClearanceColor = (clearance: number): string => {
        switch (clearance) {
            case 5: return 'text-purple-400';
            case 4: return 'text-blue-400';
            case 3: return 'text-green-400';
            case 1: return 'text-purple-400';
            default: return 'text-white/60';
        }
    };

    // Member Card Component with details menu
    // Dropdown positioning fix: Uses relative/absolute positioning to keep menu anchored close to the three-dot icon
    const MemberCard = ({ member, borderColor, gradientFrom, gradientTo, textColor, inactiveBorderColor, inactiveGradientFrom, inactiveGradientTo, inactiveTextColor }: {
        member: Member;
        borderColor: string;
        gradientFrom: string;
        gradientTo: string;
        textColor: string;
        // Inactive (muted) variants of the colors
        inactiveBorderColor: string;
        inactiveGradientFrom: string;
        inactiveGradientTo: string;
        inactiveTextColor: string;
    }) => {
        const menuButtonRef = useRef<HTMLButtonElement>(null);
        const [showAbove, setShowAbove] = useState(false);
        const isInactive = member.is_inactive || false;
        const daysInactive = getDaysInactive(member.inactive_since);

        // Use inactive colors if member is inactive
        const currentBorderColor = isInactive ? inactiveBorderColor : borderColor;
        const currentGradientFrom = isInactive ? inactiveGradientFrom : gradientFrom;
        const currentGradientTo = isInactive ? inactiveGradientTo : gradientTo;
        const currentTextColor = isInactive ? inactiveTextColor : textColor;

        // Check if dropdown should appear above or below the button
        // This keeps the menu visually anchored to the three-dot icon
        useEffect(() => {
            if (detailsOpen === member.member_id && menuButtonRef.current) {
                const rect = menuButtonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const menuHeight = 320;
                setShowAbove(spaceBelow < menuHeight);
            }
        }, [detailsOpen, member.member_id]);

        return (
            <div
                className={`bg-gray-800/30 rounded-xl p-5 border ${currentBorderColor} hover:border-opacity-60 transition-all relative group ${isInactive ? 'opacity-70' : ''}`}
            >
                {/* Inactive badge */}
                {isInactive && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-[9px] text-orange-400 font-medium">
                        Inactive {daysInactive > 0 ? `• ${daysInactive} day${daysInactive !== 1 ? 's' : ''}` : ''}
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${currentGradientFrom} ${currentGradientTo} flex items-center justify-center ${currentTextColor}`}>
                        {getIcon(member.icon, 20)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className={`font-bold truncate ${isInactive ? 'text-white/60' : 'text-white'}`}>{formatName(member.name)}</h3>
                        <p className={`text-sm truncate ${isInactive ? 'text-white/30' : 'text-white/50'}`}>{member.role}</p>
                    </div>
                    {/* 3-dot menu - always visible on mobile (touch), visible on hover for desktop */}
                    {/* Dropdown positioning: Uses absolute positioning relative to button container */}
                    <div className="relative">
                        <button
                            ref={menuButtonRef}
                            onClick={(e) => {
                                e.stopPropagation();
                                setDetailsOpen(detailsOpen === member.member_id ? null : member.member_id);
                                setMenuOpen(null);
                            }}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                            <MoreVertical size={18} />
                        </button>
                        <AnimatePresence>
                            {detailsOpen === member.member_id && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`absolute right-0 ${showAbove ? 'bottom-full mb-2' : 'top-full mt-2'} bg-gray-800 border border-white/10 rounded-lg shadow-2xl min-w-[220px] max-h-[320px] overflow-y-auto z-50`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Member Photo - Show if profile_pic exists */}
                                    {member.profile_pic && (
                                        <div className="p-3 border-b border-white/10 flex justify-center">
                                            <img
                                                src={member.profile_pic}
                                                alt={member.name}
                                                className="w-20 h-24 rounded-lg object-cover border border-white/20"
                                            />
                                        </div>
                                    )}
                                    {/* Member Details */}
                                    <div className="px-4 py-3 border-b border-white/10">
                                        <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Member Details</p>
                                        <div className="space-y-2">
                                            {member.phone && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Phone size={14} className="text-white/40" />
                                                    <span className="text-white/80">{member.phone}</span>
                                                </div>
                                            )}
                                            {member.personal_email && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Mail size={14} className="text-white/40" />
                                                    <span className="text-white/80 truncate max-w-[180px]">{member.personal_email}</span>
                                                </div>
                                            )}
                                            {member.roll_no && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Hash size={14} className="text-white/40" />
                                                    <span className="text-white/80">{member.roll_no}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-sm">
                                                <Shield size={14} className="text-white/40" />
                                                <span className={getClearanceColor(member.clearance)}>{getClearanceLabel(member.clearance)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Toggle Inactive option for council and super admin */}
                                    {canToggleInactive && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleInactive(member);
                                            }}
                                            disabled={togglingInactive === member.member_id}
                                            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-colors text-sm ${isInactive
                                                ? 'text-green-400 hover:bg-green-500/10'
                                                : 'text-orange-400 hover:bg-orange-500/10'
                                                } disabled:opacity-50`}
                                        >
                                            {togglingInactive === member.member_id ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                                                    Updating...
                                                </>
                                            ) : isInactive ? (
                                                <>
                                                    <ToggleRight size={14} />
                                                    Mark as Active
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft size={14} />
                                                    Mark as Inactive
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {/* Delete option for council */}
                                    {canDeleteMember(member) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailsOpen(null);
                                                setDeleteConfirm({ show: true, member });
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                                        >
                                            <Trash2 size={14} />
                                            Remove Member
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                        {getMemberDivisions(member).map(divId => (
                            <span key={divId} className={`text-[10px] px-2 py-1 rounded-full border ${isInactive ? 'bg-white/5 text-white/40 border-white/10' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                {divisions.find(d => d.id === divId)?.label}
                            </span>
                        ))}
                    </div>
                    <span className="text-white/30 text-xs font-mono">{member.member_id}</span>
                </div>
            </div>
        )
    };

    // Alumni Card Component - greyed out, read-only, non-interactive
    // Shows only: Name, Alumni ID, Division (hides: clearance, year, tasks, action buttons)
    const AlumniCard = ({ member }: { member: Member }) => (
        <div
            // Greyed styling: reduced opacity, muted border, no hover effects
            className="bg-gray-800/20 rounded-xl p-5 border border-white/10 opacity-60 cursor-default"
        >
            <div className="flex items-center gap-4">
                {/* Greyed avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-700/30 flex items-center justify-center text-white/30">
                    {getIcon(member.icon, 20)}
                </div>
                <div className="min-w-0 flex-1">
                    {/* Muted text color for alumni name */}
                    <h3 className="text-white/50 font-bold truncate">{formatName(member.name)}</h3>
                    {/* No role shown for alumni - just "Alumni" indicator via styling */}
                </div>
                {/* No menu button for alumni - read-only */}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                {/* Division tags in muted grey */}
                <div className="flex flex-wrap gap-1">
                    {getMemberDivisions(member).map(divId => (
                        <span key={divId} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/30 border border-white/10">
                            {divisions.find(d => d.id === divId)?.label}
                        </span>
                    ))}
                </div>
                {/* Alumni ID in muted text */}
                <span className="text-white/20 text-xs font-mono">{member.member_id}</span>
            </div>
        </div>
    );

    // Helper: Check if member is alumni (clearance 0 or role Alumni)
    const isAlumniMember = (member: Member): boolean => {
        return member.clearance === 0 || member.role === 'Alumni';
    };

    // DEFENSIVE GUARD: Check if member is provisional (should never appear in Team section)
    // This is a last-resort safety check - primary filtering is in getMembers() query
    const isProvisionalMember = (member: Member): boolean => {
        // Status field defines "real member" - only 'approved' members should appear
        // Provisional members have status = 'provisional', pending = 'pending', rejected = 'rejected'
        return member.status !== undefined && member.status !== 'approved';
    };

    // Filter active members (exclude alumni AND provisional members) for year sections
    // CRITICAL: Double-safety ensures provisional members never appear in Team section
    const activeMembers = filteredMembers.filter(m => !isAlumniMember(m) && !isProvisionalMember(m));

    // Filter alumni members separately (also exclude provisional as safety)
    const alumniMembers = filteredMembers.filter(m => isAlumniMember(m) && !isProvisionalMember(m));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6" onClick={() => { setMenuOpen(null); setDetailsOpen(null); }}>
            <h1 className="text-2xl font-bold text-white">Team Members</h1>

            {/* Division Tabs */}
            <div className="flex flex-wrap gap-2">
                {divisions.map((div) => (
                    <button
                        key={div.id}
                        onClick={() => setActiveDiv(div.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeDiv === div.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800/50 text-white/60 hover:bg-gray-800 hover:text-white/80'
                            }`}
                    >
                        {div.icon}
                        <span className="hidden sm:inline">{div.label}</span>
                    </button>
                ))}
            </div>

            {/* Division Title */}
            {activeDiv !== 'all' && (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                        {divisions.find(d => d.id === activeDiv)?.icon}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{divisions.find(d => d.id === activeDiv)?.label}</h2>
                        <p className="text-white/40 text-sm">{activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}{alumniMembers.length > 0 ? `, ${alumniMembers.length} alumni` : ''}</p>
                    </div>
                </div>
            )}

            {/* 4th Year Section - Active members only (excludes alumni) */}
            {activeMembers.filter(m => getMemberYear(m) === 4).length > 0 && (
                <>
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-blue-500/50 to-transparent"></div>
                        <span className="text-blue-400 text-sm font-bold uppercase tracking-wider">4th Year</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-blue-500/50 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeMembers.filter(m => getMemberYear(m) === 4).map((member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                borderColor="border-blue-500/20"
                                gradientFrom="from-blue-500/20"
                                gradientTo="to-indigo-500/20"
                                textColor="text-blue-400"
                                inactiveBorderColor="border-blue-500/10"
                                inactiveGradientFrom="from-blue-900/20"
                                inactiveGradientTo="to-indigo-900/20"
                                inactiveTextColor="text-blue-600/60"
                            />
                        ))}
                    </div>
                </>
            )}

            {/* 5th Year Section - Active members only (excludes alumni) */}
            {activeMembers.filter(m => getMemberYear(m) === 5).length > 0 && (
                <>
                    <div className="flex items-center gap-4 mt-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-red-500/50 to-transparent"></div>
                        <span className="text-red-400 text-sm font-bold uppercase tracking-wider">5th Year</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-red-500/50 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeMembers.filter(m => getMemberYear(m) === 5).map((member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                borderColor="border-red-500/20"
                                gradientFrom="from-red-500/20"
                                gradientTo="to-orange-500/20"
                                textColor="text-red-400"
                                inactiveBorderColor="border-red-500/10"
                                inactiveGradientFrom="from-red-900/20"
                                inactiveGradientTo="to-orange-900/20"
                                inactiveTextColor="text-red-600/60"
                            />
                        ))}
                    </div>
                </>
            )}

            {/* 3rd Year Section - Active members only (excludes alumni) */}
            {activeMembers.filter(m => getMemberYear(m) === 3).length > 0 && (
                <>
                    <div className="flex items-center gap-4 mt-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/50 to-transparent"></div>
                        <span className="text-yellow-400 text-sm font-bold uppercase tracking-wider">3rd Year</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-yellow-500/50 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeMembers.filter(m => getMemberYear(m) === 3).map((member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                borderColor="border-yellow-500/20"
                                gradientFrom="from-yellow-500/20"
                                gradientTo="to-orange-500/20"
                                textColor="text-yellow-400"
                                inactiveBorderColor="border-yellow-500/10"
                                inactiveGradientFrom="from-yellow-900/20"
                                inactiveGradientTo="to-orange-900/20"
                                inactiveTextColor="text-yellow-600/60"
                            />
                        ))}
                    </div>
                </>
            )}

            {/* 2nd Year Section - Active members only (excludes alumni) */}
            {activeMembers.filter(m => getMemberYear(m) === 2).length > 0 && (
                <>
                    <div className="flex items-center gap-4 mt-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-green-500/50 to-transparent"></div>
                        <span className="text-green-400 text-sm font-bold uppercase tracking-wider">2nd Year</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-green-500/50 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeMembers.filter(m => getMemberYear(m) === 2).map((member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                borderColor="border-green-500/20"
                                gradientFrom="from-green-500/20"
                                gradientTo="to-teal-500/20"
                                textColor="text-green-400"
                                inactiveBorderColor="border-green-500/10"
                                inactiveGradientFrom="from-green-900/20"
                                inactiveGradientTo="to-teal-900/20"
                                inactiveTextColor="text-green-600/60"
                            />
                        ))}
                    </div>
                </>
            )}

            {/* 1st Year Section - Active members only (excludes alumni) */}
            {activeMembers.filter(m => getMemberYear(m) === 1).length > 0 && (
                <>
                    <div className="flex items-center gap-4 mt-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-purple-500/50 to-transparent"></div>
                        <span className="text-purple-400 text-sm font-bold uppercase tracking-wider">1st Year</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-purple-500/50 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeMembers.filter(m => getMemberYear(m) === 1).map((member) => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                borderColor="border-purple-500/20"
                                gradientFrom="from-purple-500/20"
                                gradientTo="to-pink-500/20"
                                textColor="text-purple-400"
                                inactiveBorderColor="border-purple-500/10"
                                inactiveGradientFrom="from-purple-900/20"
                                inactiveGradientTo="to-pink-900/20"
                                inactiveTextColor="text-purple-600/60"
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Alumni Section - Greyed out, read-only, informational only */}
            {/* Alumni are visible but visually differentiated from active members */}
            {alumniMembers.length > 0 && (
                <>
                    <div className="flex items-center gap-4 mt-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-gray-500/30 to-transparent"></div>
                        <span className="text-white/30 text-sm font-bold uppercase tracking-wider">Alumni</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-gray-500/30 to-transparent"></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {alumniMembers.map((member) => (
                            <AlumniCard key={member.id} member={member} />
                        ))}
                    </div>
                </>
            )}

            {filteredMembers.length === 0 && (
                <div className="text-center py-12 text-white/40">
                    <Users size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No members in this division yet</p>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm.show && deleteConfirm.member && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => !isDeleting && setDeleteConfirm({ show: false, member: null })}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <AlertTriangle size={24} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Remove Member?</h3>
                                    <p className="text-white/50 text-sm">This action cannot be undone</p>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                                <p className="text-white font-medium">{formatName(deleteConfirm.member.name)}</p>
                                <p className="text-white/50 text-sm">{deleteConfirm.member.member_id} • {deleteConfirm.member.role}</p>
                            </div>

                            <p className="text-white/70 text-sm mb-6">
                                This will permanently delete <span className="text-white font-medium">{formatName(deleteConfirm.member.name)}</span> and all their associated data including:
                            </p>
                            <ul className="text-white/50 text-sm mb-6 space-y-1 ml-4">
                                <li>• All tasks assigned to them</li>
                                <li>• All tasks they assigned to others</li>
                                <li>• All their notifications</li>
                                <li>• All their activity logs</li>
                                <li>• Any announcements they created</li>
                            </ul>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm({ show: false, member: null })}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteMember(deleteConfirm.member!)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Removing...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            Remove Member
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Division Requests Tab Component - For Council Members to approve/reject division requests
const DivisionRequestsTab = ({ currentMember }: { currentMember: Member }) => {
    const [requests, setRequests] = useState<DivisionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    // Find which division this council member heads
    const myDivision = Object.entries(DIVISION_HEADS).find(
        ([_, head]) => head.member_id === currentMember.member_id
    )?.[0];

    const isCouncil = currentMember.clearance === 5;

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setIsLoading(true);
        // Clean up old requests (older than 7 days)
        await deleteOldDivisionRequests();
        // If council member, show all requests. If division head, show only their division
        const data = await getDivisionRequests();
        setRequests(data);
        setIsLoading(false);
    };

    const handleApprove = async (request: DivisionRequest) => {
        setProcessingId(request.id);
        const success = await approveDivisionRequest(request.id, currentMember.member_id);

        if (success) {
            // Notify the member
            await createNotification({
                member_id: request.member_id,
                type: 'system',
                title: 'Division Request Approved! 🎉',
                message: `Your request to join ${request.division} has been approved by ${formatName(currentMember.name)}.`
            });

            setSuccessMessage(`Approved ${formatName(request.member_name)} for ${request.division}`);
            setTimeout(() => setSuccessMessage(''), 3000);
            loadRequests();
        }
        setProcessingId(null);
    };

    const handleReject = async (request: DivisionRequest) => {
        setProcessingId(request.id);
        const success = await rejectDivisionRequest(request.id, currentMember.member_id);

        if (success) {
            // Notify the member
            await createNotification({
                member_id: request.member_id,
                type: 'system',
                title: 'Division Request Update',
                message: `Your request to join ${request.division} was not approved at this time.`
            });

            setSuccessMessage(`Rejected request from ${formatName(request.member_name)}`);
            setTimeout(() => setSuccessMessage(''), 3000);
            loadRequests();
        }
        setProcessingId(null);
    };

    const filteredRequests = requests.filter(r => {
        // Filter by status
        if (filter !== 'all' && r.status !== filter) return false;

        // If user is a division head, only show requests for their division
        // Unless they're council (clearance 5), then show all
        if (myDivision && !isCouncil && r.division !== myDivision) return false;

        return true;
    });

    const pendingCount = requests.filter(r => r.status === 'pending' && (isCouncil || r.division === myDivision)).length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <UserPlus className="text-blue-400" />
                        Division Requests
                        {pendingCount > 0 && (
                            <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                                {pendingCount} pending
                            </span>
                        )}
                    </h2>
                    <p className="text-white/60 text-sm mt-1">
                        {myDivision ? `Review requests for ${myDivision}` : 'Review all division requests'}
                    </p>
                </div>

                {/* Filter */}
                <div className="flex gap-2">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === status
                                ? status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                    : status === 'approved' ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                        : status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"
                >
                    <CheckCircle2 size={18} />
                    {successMessage}
                </motion.div>
            )}

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                        <CheckCircle2 size={32} className="text-white/30" />
                    </div>
                    <h3 className="text-white/60 text-lg mb-2">No {filter !== 'all' ? filter : ''} requests</h3>
                    <p className="text-white/40 text-sm">
                        {filter === 'pending' ? 'All caught up! No pending requests to review.' : 'No requests found with this filter.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRequests.map(request => (
                        <motion.div
                            key={request.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-white/5 border rounded-xl p-4 ${request.status === 'pending' ? 'border-yellow-500/30'
                                : request.status === 'approved' ? 'border-green-500/30'
                                    : 'border-red-500/30'
                                }`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400'
                                        : request.status === 'approved' ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {formatName(request.member_name).charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">{formatName(request.member_name)}</h3>
                                        <p className="text-white/50 text-sm">{request.member_id}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                                {request.division}
                                            </span>
                                            <span className="text-white/30 text-xs">
                                                {new Date(request.requested_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {request.status === 'pending' ? (
                                        <>
                                            <button
                                                onClick={() => handleApprove(request)}
                                                disabled={processingId === request.id}
                                                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {processingId === request.id ? (
                                                    <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                                ) : (
                                                    <Check size={16} />
                                                )}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(request)}
                                                disabled={processingId === request.id}
                                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <X size={16} />
                                                Reject
                                            </button>
                                        </>
                                    ) : (
                                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${request.status === 'approved'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {request.status}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {request.reviewed_by && (
                                <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/40">
                                    {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.reviewed_by} on {new Date(request.reviewed_at || '').toLocaleString()}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Settings Tab Component
const SettingsTab = ({ currentMember, onLogout }: { currentMember: Member; onLogout: () => void }) => {
    const [activeSection, setActiveSection] = useState<'password' | 'profile' | null>(null);
    const isProvisional = sessionStorage.getItem('udaanIsProvisional') === 'true';

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Profile edit state
    const [editPersonalEmail, setEditPersonalEmail] = useState(currentMember.personal_email || '');
    const [editRollNo, setEditRollNo] = useState(currentMember.roll_no || '');
    const [editPhone, setEditPhone] = useState(currentMember.phone || '');

    // Valid subsystem divisions only (not roles like "Council")
    const validSubsystems = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];
    const [editDivisions, setEditDivisions] = useState<string[]>(
        currentMember.division
            ? currentMember.division.split(',').map(d => d.trim()).filter(d => validSubsystems.includes(d))
            : []
    );
    const [pendingRequests, setPendingRequests] = useState<string[]>([]);
    const [isRequestingDivision, setIsRequestingDivision] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Email verification state
    const [emailVerified, setEmailVerified] = useState(currentMember.email_verified || false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [showVerificationInput, setShowVerificationInput] = useState(false);
    const [verificationError, setVerificationError] = useState('');
    const [verificationSuccess, setVerificationSuccess] = useState('');
    const [savedEmail, setSavedEmail] = useState(currentMember.personal_email || '');
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    // Cooldown state to prevent email spam (60 seconds between sends)
    const [lastEmailSentAt, setLastEmailSentAt] = useState<number>(0);
    const EMAIL_COOLDOWN_MS = 60000;

    // Check email verification status on mount
    useEffect(() => {
        const checkVerification = async () => {
            const status = await getEmailVerificationStatus(currentMember.member_id);
            setEmailVerified(status.verified);
            if (status.email) setSavedEmail(status.email);
        };
        checkVerification();
    }, [currentMember.member_id]);

    // Reset verification when email changes
    useEffect(() => {
        if (editPersonalEmail !== savedEmail && savedEmail) {
            setEmailVerified(false);
            setShowVerificationInput(false);
            setVerificationCode('');
        }
    }, [editPersonalEmail, savedEmail]);

    // Phone verification removed: no phone OTP handling

    // Handle sending verification code
    const handleSendVerificationCode = async () => {
        if (!editPersonalEmail) {
            setVerificationError('Please enter your personal email first');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editPersonalEmail)) {
            setVerificationError('Please enter a valid email address');
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

        const result = await sendEmailVerificationCode(currentMember.member_id, editPersonalEmail, currentMember.name);

        if (result.success) {
            setLastEmailSentAt(Date.now()); // Record send time for cooldown
            setShowVerificationInput(true);
            setVerificationSuccess(result.message);
            setSavedEmail(editPersonalEmail);
            // Keep success message longer if it contains the code (dev mode)
            if (result.code) {
                // Don't auto-hide in dev mode so user can see the code
            } else {
                setTimeout(() => setVerificationSuccess(''), 8000);
            }
        } else {
            setVerificationError(result.message);
        }
        setIsSendingCode(false);
    };

    // Handle verifying the code
    const handleVerifyCode = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setVerificationError('Please enter the 6-digit verification code');
            return;
        }

        setIsVerifyingCode(true);
        setVerificationError('');
        setVerificationSuccess('');

        const result = await verifyEmailCode(currentMember.member_id, verificationCode);

        if (result.success) {
            setEmailVerified(true);
            setShowVerificationInput(false);
            setVerificationCode('');
            setVerificationSuccess(result.message);
            setTimeout(() => setVerificationSuccess(''), 5000);
        } else {
            setVerificationError(result.message);
        }
        setIsVerifyingCode(false);
    };

    // Department options with codes
    const departmentsList = [
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

    // Auto-generate institute email and department from roll number
    const instituteEmail = editRollNo ? `${editRollNo.toLowerCase()}@nitrkl.ac.in` : '';
    const detectedDeptCode = getDeptFromRollNo(editRollNo);
    const detectedDept = departmentsList.find(d => d.code === detectedDeptCode);
    const department = detectedDept ? `${detectedDept.name} (${detectedDept.code})` : '';

    const divisions = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];

    const toggleDivision = (div: string) => {
        setEditDivisions(prev =>
            prev.includes(div)
                ? prev.filter(d => d !== div)
                : [...prev, div]
        );
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        setIsChangingPassword(true);
        const result = await changeMemberPassword(currentMember.member_id, currentPassword, newPassword);

        if (result.success) {
            setPasswordSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(''), 3000);
        } else {
            setPasswordError(result.message);
        }
        setIsChangingPassword(false);
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');

        // Validate required fields
        if (!editRollNo) {
            setProfileError('Roll number is required');
            return;
        }

        if (!detectedDeptCode) {
            setProfileError('Invalid roll number format. Cannot detect department.');
            return;
        }

        if (!editPersonalEmail) {
            setProfileError('Personal email is required');
            return;
        }

        // Validate phone number - must be exactly 10 digits
        if (!editPhone || !/^\d{10}$/.test(editPhone)) {
            setProfileError('Phone number must be exactly 10 digits');
            return;
        }

        setIsUpdatingProfile(true);
        const result = await updateMemberProfile(currentMember.member_id, {
            personal_email: editPersonalEmail,
            institute_email: instituteEmail,
            roll_no: editRollNo,
            phone: editPhone,
            department: department
            // Note: Division is updated via request system, not directly
        });

        if (result) {
            setProfileSuccess('Profile updated successfully! Changes will reflect after re-login.');
            setTimeout(() => setProfileSuccess(''), 3000);
        } else {
            setProfileError('Failed to update profile. Please try again.');
        }
        setIsUpdatingProfile(false);
    };

    // Rate limit state
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; nextAllowedDate?: string; message?: string } | null>(null);

    // Check rate limit on mount
    useEffect(() => {
        const checkRateLimit = async () => {
            const result = await canSubmitDivisionRequest(currentMember.member_id);
            setRateLimitInfo(result);
        };
        checkRateLimit();
    }, [currentMember.member_id]);

    // Handle division request
    const handleDivisionRequest = async (division: string) => {
        setIsRequestingDivision(true);
        setProfileError('');

        // Check rate limiting first - can only submit 1 request per week
        const rateLimit = await canSubmitDivisionRequest(currentMember.member_id);
        if (!rateLimit.allowed && rateLimit.nextAllowedDate) {
            const nextDate = new Date(rateLimit.nextAllowedDate);
            const formattedDate = nextDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            setProfileError(`Rate limit: You can only request once per week. Try again after ${formattedDate}`);
            setRateLimitInfo(rateLimit);
            setIsRequestingDivision(false);
            return;
        }

        // Check if already has pending request for this specific division
        const hasPending = await hasPendingDivisionRequest(currentMember.member_id, division);
        if (hasPending) {
            setProfileError(`You already have a pending request for ${division}`);
            setIsRequestingDivision(false);
            return;
        }

        // Submit request
        const result = await submitDivisionRequest({
            member_id: currentMember.member_id,
            member_name: currentMember.name,
            division: division
        });

        if (result) {
            // Get division head info
            const divisionHead = DIVISION_HEADS[division];
            if (divisionHead) {
                // Send notifications
                await notifyDivisionRequest(currentMember.name, division, divisionHead.member_id);
            }

            setPendingRequests(prev => [...prev, division]);

            // Update rate limit info since user just submitted
            const newRateLimit = await canSubmitDivisionRequest(currentMember.member_id);
            setRateLimitInfo(newRateLimit);

            setProfileSuccess(`Request sent to ${divisionHead?.name || 'division head'} for ${division}. All council members have been notified.`);
            setTimeout(() => setProfileSuccess(''), 5000);
        } else {
            setProfileError('Failed to submit request. Please try again.');
        }
        setIsRequestingDivision(false);
    };

    // Check if current user is UDAAN-000 (super admin) - only show password change
    const isSuperAdminUser = currentMember.member_id === 'UDAAN-000';

    const settingsSections = isProvisional || isSuperAdminUser
        ? [
            { id: 'password', label: 'Change Password', icon: <Lock size={20} />, description: 'Update your login password' },
        ]
        : [
            { id: 'password', label: 'Change Password', icon: <Lock size={20} />, description: 'Update your login password' },
            { id: 'profile', label: 'Edit Profile', icon: <Edit3 size={20} />, description: 'Update contact details and divisions' },
        ];

    // Provisional members get a simplified settings view (password change only)
    if (isProvisional) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-white/50 text-sm mt-1">Manage your account</p>
                </div>

                {/* Account Info */}
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl border border-blue-500/30 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                            <User size={28} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-white">{currentMember.name}</h2>
                            <p className="text-white/50 text-sm">Induction Candidate</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-mono">{currentMember.member_id}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Change Only */}
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-5">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                        <Lock size={18} className="text-blue-400" />
                        Change Password
                    </h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        {passwordError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle size={16} />
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                                <CheckCircle2 size={16} />
                                {passwordSuccess}
                            </div>
                        )}

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isChangingPassword ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Changing...
                                </>
                            ) : (
                                <>
                                    <Lock size={18} />
                                    Change Password
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        );
    }

    // UDAAN-000 gets a simplified settings view
    if (isSuperAdminUser) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-white/50 text-sm mt-1">System Administrator Settings</p>
                </div>

                {/* Admin Account Info */}
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-xl border border-red-500/30 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white">
                            <Shield size={28} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-white">UDAAN Administration</h2>
                            <p className="text-white/50 text-sm">System Administrator Account</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-mono">UDAAN-000</span>
                                <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Super Admin</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/10">
                        <p className="text-white/60 text-xs">
                            This account has full system access. Profile editing, ID cards, and personal information are not applicable.
                        </p>
                    </div>
                </div>

                {/* Password Change Only */}
                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-5">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                        <Lock size={18} className="text-blue-400" />
                        Change Password
                    </h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        {passwordError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                                <AlertCircle size={16} />
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                                <CheckCircle2 size={16} />
                                {passwordSuccess}
                            </div>
                        )}

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isChangingPassword ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Changing...
                                </>
                            ) : (
                                <>
                                    <Lock size={18} />
                                    Change Password
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-white/50 text-sm mt-1">Manage your account and preferences</p>
            </div>

            {/* Account Info Card */}
            <div className="bg-gray-800/50 rounded-xl border border-white/10 p-5">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                        {getIcon(currentMember.icon, 24)}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-white">{formatName(currentMember.name)}</h2>
                        {currentMember.personal_email && emailVerified ? (
                            <p className="text-white/50 text-sm flex items-center gap-1">
                                {currentMember.personal_email}
                                <CheckCircle2 size={14} className="text-green-400" />
                            </p>
                        ) : (
                            <p className="text-white/50 text-sm">{currentMember.email}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">{currentMember.member_id}</span>
                            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">{currentMember.role}</span>
                        </div>
                    </div>
                </div>

                {/* Profile Completion Status */}
                {(!currentMember.roll_no || !currentMember.phone || !currentMember.personal_email || !emailVerified) && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-xs flex items-center gap-2">
                            <AlertCircle size={14} />
                            Complete your profile to remove this warning
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {!currentMember.roll_no && (
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Roll No. missing</span>
                            )}
                            {!currentMember.phone && (
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Phone missing</span>
                            )}
                            {!currentMember.personal_email && (
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Email missing</span>
                            )}
                            {currentMember.personal_email && !emailVerified && (
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Email not verified</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Sections */}
            <div className="space-y-3">
                {settingsSections.map((section) => (
                    <motion.div key={section.id}>
                        <button
                            onClick={() => setActiveSection(activeSection === section.id ? null : section.id as 'password' | 'profile')}
                            className={`w-full bg-gray-800/50 rounded-xl border p-4 flex items-center justify-between transition-all ${activeSection === section.id
                                ? 'border-blue-500/50 bg-blue-500/5'
                                : 'border-white/10 hover:border-white/20'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${activeSection === section.id ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/60'}`}>
                                    {section.icon}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-white font-medium">{section.label}</h3>
                                    <p className="text-white/40 text-sm">{section.description}</p>
                                </div>
                            </div>
                            <ChevronRight
                                size={20}
                                className={`text-white/40 transition-transform ${activeSection === section.id ? 'rotate-90' : ''}`}
                            />
                        </button>

                        <AnimatePresence>
                            {activeSection === section.id && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-gray-800/30 rounded-b-xl border border-t-0 border-white/10 p-5 mt-[-1px]">
                                        {/* Password Change Section */}
                                        {section.id === 'password' && (
                                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                                {passwordError && (
                                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                                                        <AlertCircle size={16} />
                                                        {passwordError}
                                                    </div>
                                                )}
                                                {passwordSuccess && (
                                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                                                        <CheckCircle2 size={16} />
                                                        {passwordSuccess}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Current Password
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type={showCurrentPassword ? 'text' : 'password'}
                                                            value={currentPassword}
                                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        New Password
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type={showNewPassword ? 'text' : 'password'}
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                                            required
                                                            minLength={6}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Confirm New Password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                                        required
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={isChangingPassword}
                                                    className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {isChangingPassword ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            Changing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock size={18} />
                                                            Change Password
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        )}

                                        {/* Profile Edit Section */}
                                        {section.id === 'profile' && (
                                            <form onSubmit={handleProfileUpdate} className="space-y-4">
                                                {profileError && (
                                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                                                        <AlertCircle size={16} />
                                                        {profileError}
                                                    </div>
                                                )}
                                                {profileSuccess && (
                                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
                                                        <CheckCircle2 size={16} />
                                                        {profileSuccess}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Roll Number *
                                                        {currentMember.roll_no && (
                                                            <span className="ml-2 text-green-400/70 normal-case">(Locked)</span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editRollNo}
                                                        onChange={(e) => !currentMember.roll_no && setEditRollNo(e.target.value.toUpperCase())}
                                                        placeholder="121CS0XXX"
                                                        className={`w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none font-mono uppercase ${currentMember.roll_no
                                                            ? 'cursor-not-allowed text-white/60 border-green-500/30'
                                                            : 'focus:border-blue-500/50'
                                                            }`}
                                                        readOnly={!!currentMember.roll_no}
                                                        required
                                                    />
                                                    {currentMember.roll_no && (
                                                        <p className="text-green-400/60 text-xs mt-1 flex items-center gap-1">
                                                            <Lock size={10} /> Roll number cannot be changed once set
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Department <span className="text-white/40 normal-case">(Auto-detected from Roll No.)</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={department || currentMember.department || ''}
                                                        readOnly
                                                        placeholder="Enter roll number above..."
                                                        className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white/70 placeholder:text-white/30 focus:outline-none cursor-not-allowed ${currentMember.department ? 'border-green-500/30' : 'border-white/10'
                                                            }`}
                                                    />
                                                    {detectedDeptCode && !currentMember.department && (
                                                        <p className="text-blue-400/70 text-xs mt-1">
                                                            Detected: {detectedDeptCode}
                                                        </p>
                                                    )}
                                                    {currentMember.department && (
                                                        <p className="text-green-400/60 text-xs mt-1 flex items-center gap-1">
                                                            <Lock size={10} /> Department is locked
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Institute Email <span className="text-white/40 normal-case">(Auto-generated)</span>
                                                        {currentMember.institute_email && (
                                                            <span className="ml-2 text-green-400/70 normal-case">(Locked)</span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="email"
                                                        value={instituteEmail || currentMember.institute_email || ''}
                                                        readOnly
                                                        placeholder="Enter roll number above..."
                                                        className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white/70 placeholder:text-white/30 focus:outline-none cursor-not-allowed ${currentMember.institute_email ? 'border-green-500/30' : 'border-white/10'
                                                            }`}
                                                    />
                                                    {currentMember.institute_email && (
                                                        <p className="text-green-400/60 text-xs mt-1 flex items-center gap-1">
                                                            <Lock size={10} /> Institute email cannot be changed
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Personal Email *
                                                        {emailVerified && editPersonalEmail === savedEmail && !isChangingEmail && (
                                                            <span className="ml-2 text-green-400 normal-case">
                                                                ✓ Verified
                                                            </span>
                                                        )}
                                                    </label>

                                                    {/* Show locked email with change button when verified */}
                                                    {emailVerified && !isChangingEmail ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="email"
                                                                value={savedEmail}
                                                                readOnly
                                                                className="flex-1 bg-white/5 border border-green-500/50 rounded-lg px-4 py-3 text-white/70 cursor-not-allowed"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsChangingEmail(true);
                                                                    setEditPersonalEmail('');
                                                                    setEmailVerified(false);
                                                                    setShowVerificationInput(false);
                                                                    setVerificationCode('');
                                                                    setVerificationError('');
                                                                    setVerificationSuccess('');
                                                                }}
                                                                className="px-4 py-3 bg-orange-500/20 border border-orange-500/50 rounded-lg text-orange-400 hover:bg-orange-500/30 transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                                                            >
                                                                <Edit3 size={16} />
                                                                Change
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <div className="flex gap-2 flex-1">
                                                                    <input
                                                                        type="email"
                                                                        value={editPersonalEmail}
                                                                        onChange={(e) => setEditPersonalEmail(e.target.value)}
                                                                        placeholder="your.personal@gmail.com"
                                                                        className={`flex-1 bg-white/5 border rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 ${emailVerified && editPersonalEmail === savedEmail
                                                                            ? 'border-green-500/50'
                                                                            : 'border-white/10'
                                                                            }`}
                                                                        required
                                                                    />
                                                                    {isChangingEmail && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setIsChangingEmail(false);
                                                                                setEditPersonalEmail(savedEmail);
                                                                                setEmailVerified(true);
                                                                                setShowVerificationInput(false);
                                                                                setVerificationCode('');
                                                                                setVerificationError('');
                                                                            }}
                                                                            className="px-3 py-3 bg-white/5 border border-white/20 rounded-lg text-white/60 hover:bg-white/10 transition-all flex-shrink-0"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {(!emailVerified || editPersonalEmail !== savedEmail) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleSendVerificationCode}
                                                                        disabled={isSendingCode || !editPersonalEmail}
                                                                        className="w-full sm:w-auto px-4 py-3 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                                                    >
                                                                        {isSendingCode ? (
                                                                            <>
                                                                                <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                                                                                Sending...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Send size={16} />
                                                                                Verify Email
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {isChangingEmail && (
                                                                <p className="text-orange-400/70 text-xs mt-1">
                                                                    ⚠ Enter new email and verify to update
                                                                </p>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Verification Status Messages */}
                                                    {verificationError && (
                                                        <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                                            <AlertCircle size={12} />
                                                            {verificationError}
                                                        </p>
                                                    )}
                                                    {verificationSuccess && (
                                                        <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
                                                            <CheckCircle2 size={12} />
                                                            {verificationSuccess}
                                                        </p>
                                                    )}

                                                    {/* Verification Code Input */}
                                                    {showVerificationInput && !emailVerified && (
                                                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3">
                                                            <p className="text-blue-400 text-xs">
                                                                Enter the 6-digit code sent to your email:
                                                            </p>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={verificationCode}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                                        setVerificationCode(value);
                                                                    }}
                                                                    placeholder="000000"
                                                                    maxLength={6}
                                                                    className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-2 text-white text-center font-mono text-lg tracking-widest placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleVerifyCode}
                                                                    disabled={isVerifyingCode || verificationCode.length !== 6}
                                                                    className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                >
                                                                    {isVerifyingCode ? (
                                                                        <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin"></div>
                                                                    ) : (
                                                                        <Check size={16} />
                                                                    )}
                                                                    Confirm
                                                                </button>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={handleSendVerificationCode}
                                                                disabled={isSendingCode}
                                                                className="text-blue-400/70 text-xs hover:text-blue-400 transition-colors"
                                                            >
                                                                Didn't receive code? Resend
                                                            </button>
                                                        </div>
                                                    )}

                                                    {!emailVerified && editPersonalEmail && !showVerificationInput && (
                                                        <p className="text-yellow-400/70 text-xs mt-1">
                                                            ⚠ Email not verified. Click "Verify" to receive a verification code.
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Phone Number <span className="text-white/40 normal-case">(10 digits)</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="tel"
                                                            value={editPhone}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                                setEditPhone(value);
                                                            }}
                                                            placeholder="XXXXXXXXXX"
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 font-mono"
                                                        />
                                                    </div>
                                                    <p className="text-white/40 text-xs mt-1">Provide your phone number (optional). Phone OTP verification has been removed.</p>
                                                </div>

                                                <div>
                                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                                        Division(s)
                                                    </label>

                                                    {/* Current Divisions (locked) - only show valid subsystems */}
                                                    {(() => {
                                                        const validDivisions = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];
                                                        const currentDivs = currentMember.division
                                                            ? currentMember.division.split(',').map(d => d.trim()).filter(d => validDivisions.includes(d))
                                                            : [];

                                                        if (currentDivs.length > 0) {
                                                            return (
                                                                <div className="mb-3">
                                                                    <p className="text-white/40 text-xs mb-2">Current Division(s):</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {currentDivs.map(div => (
                                                                            <span
                                                                                key={div}
                                                                                className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400 text-sm flex items-center gap-1"
                                                                            >
                                                                                <Check size={14} />
                                                                                {div}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <p className="text-yellow-400/70 text-xs mb-3">No divisions assigned yet. Request to join a division below.</p>
                                                        );
                                                    })()}

                                                    {/* Request to Join Division */}
                                                    {(() => {
                                                        const validDivisions = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];
                                                        const currentDivs = currentMember.division
                                                            ? currentMember.division.split(',').map(d => d.trim()).filter(d => validDivisions.includes(d))
                                                            : [];
                                                        const remainingDivs = validDivisions.filter(d => !currentDivs.includes(d));

                                                        if (remainingDivs.length === 0) {
                                                            return (
                                                                <p className="text-white/40 text-xs italic">You're already in all divisions!</p>
                                                            );
                                                        }

                                                        // Check rate limit - show message if rate limited
                                                        const isRateLimited = rateLimitInfo && !rateLimitInfo.allowed;
                                                        const nextAllowedFormatted = isRateLimited && rateLimitInfo?.nextAllowedDate
                                                            ? new Date(rateLimitInfo.nextAllowedDate).toLocaleDateString('en-US', {
                                                                weekday: 'short',
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })
                                                            : null;

                                                        return (
                                                            <>
                                                                <p className="text-white/40 text-xs mb-2">Request to Join Division:</p>

                                                                {/* Rate limit warning */}
                                                                {isRateLimited && (
                                                                    <div className="mb-3 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                                                        <p className="text-orange-400 text-xs flex items-center gap-1">
                                                                            <Clock size={12} />
                                                                            Rate limited: 1 request per week. You can request again on {nextAllowedFormatted}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {remainingDivs.map(div => {
                                                                        const head = DIVISION_HEADS[div];
                                                                        const isPending = pendingRequests.includes(div);
                                                                        const isDisabled = isRequestingDivision || isPending || isRateLimited;

                                                                        return (
                                                                            <button
                                                                                key={div}
                                                                                type="button"
                                                                                onClick={() => !isDisabled && handleDivisionRequest(div)}
                                                                                disabled={isDisabled}
                                                                                className={`px-3 py-2 rounded-lg border text-sm transition-all text-left ${isPending
                                                                                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 cursor-not-allowed'
                                                                                    : isRateLimited
                                                                                        ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                                                                                        : 'bg-white/5 border-white/10 text-white/60 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400'
                                                                                    }`}
                                                                            >
                                                                                <div className="flex items-center justify-between">
                                                                                    <span>{isPending ? '⏳' : isRateLimited ? '🔒' : '+'} {div}</span>
                                                                                </div>
                                                                                <p className="text-[10px] mt-0.5 opacity-60">
                                                                                    {isPending ? 'Request pending...' : `Head: ${head?.name || 'TBA'}`}
                                                                                </p>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <p className="text-white/30 text-[10px] mt-2 italic">
                                                                    {isRateLimited
                                                                        ? 'You can only submit one division request per week.'
                                                                        : 'Click to send a request. The division head will review and approve/reject.'
                                                                    }
                                                                </p>
                                                            </>
                                                        );
                                                    })()}
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={
                                                        isUpdatingProfile ||
                                                        !editRollNo ||
                                                        !editPersonalEmail ||
                                                        !editPhone ||
                                                        editPhone.length !== 10 ||
                                                        !emailVerified
                                                    }
                                                    className="w-full py-3 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {isUpdatingProfile ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Edit3 size={18} />
                                                            Update Profile
                                                        </>
                                                    )}
                                                </button>
                                                {(!emailVerified || !editRollNo || !editPersonalEmail || editPhone.length !== 10) && (
                                                    <p className="text-yellow-400/70 text-xs text-center mt-2">
                                                        {!editRollNo ? '⚠ Roll number is required' :
                                                            !editPersonalEmail ? '⚠ Personal email is required' :
                                                                editPhone.length !== 10 ? '⚠ Valid 10-digit phone number is required' :
                                                                    !emailVerified ? '⚠ Please verify your email first' : ''}
                                                    </p>
                                                )}
                                            </form>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// Assign Task Tab Component (for Council members only)
const AssignTaskTab = ({ currentMember }: { currentMember: Member }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [assignedTasks, setAssignedTasks] = useState<SupabaseTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; taskId: string; taskTitle: string }>({ show: false, taskId: '', taskTitle: '' });

    // Filter state for member selection
    const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
    const [divisionFilter, setDivisionFilter] = useState<string>('all');
    // Search state for member selection - filters by name and member ID
    const [memberSearch, setMemberSearch] = useState('');

    // Form state
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [taskCategory, setTaskCategory] = useState('');
    const [taskDueDate, setTaskDueDate] = useState('');

    const categories = [
        'Technical', 'Design', 'Documentation', 'Meeting', 'Training',
        'Research', 'Finance', 'Coordination', 'Content', 'Procurement', 'Other'
    ];

    const divisionOptions = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            // Reset all filter states when loading new data to ensure clean state
            setYearFilter('all');
            setDivisionFilter('all');
            setMemberSearch('');
            setSelectedMembers([]);

            const [membersData, tasksData] = await Promise.all([
                getAssignableMembers(), // Use getAssignableMembers to exclude alumni and super admin
                getTasksAssignedBy(currentMember.member_id)
            ]);

            // Filter out the current user from the members list
            let otherMembers = membersData.filter(m => m.member_id !== currentMember.member_id);

            // Regular members (non-council and not 4th year) cannot assign tasks to council members
            // Council = clearance >= 5, 4th year = year === 4
            const isCouncil = currentMember.clearance >= 5;
            const is4thYear = currentMember.year === 4;

            if (!isCouncil && !is4thYear) {
                // Filter out council members (clearance >= 5) for regular members
                otherMembers = otherMembers.filter(m => m.clearance < 5);
            }

            setMembers(otherMembers.map(m => ({ ...m, icon: getRoleIcon(m.role) })));
            setAssignedTasks(tasksData);
            setIsLoading(false);
        };
        loadData();
    }, [currentMember.member_id, currentMember.clearance, currentMember.year]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedMembers.length === 0 || !taskTitle || !taskDueDate || !taskCategory) return;

        setIsSubmitting(true);
        const createdTasks: SupabaseTask[] = [];
        const assigneeNames = selectedMembers.map(id => getMemberName(id)).join(', ');

        // Create task for each selected member
        for (const memberId of selectedMembers) {
            const newTask = await createTask({
                title: taskTitle,
                description: taskDescription,
                priority: taskPriority,
                category: taskCategory,
                due_date: taskDueDate,
                assigned_to: memberId,
                assigned_by: currentMember.member_id,
                assigned_by_name: formatName(currentMember.name)
            });

            if (newTask) {
                createdTasks.push(newTask);

                // Send notification to the assigned member, including task ID in link and message
                await createNotification({
                    member_id: memberId,
                    type: 'task_assigned',
                    title: `New Task Assigned: ${newTask.title}`,
                    message: `${formatName(currentMember.name)} assigned you a ${newTask.category} task: "${newTask.title}"
Description: ${newTask.description || "No description provided."}`,
                    link: `/team-login?task_id=${newTask.id}`
                });
            }
        }

        if (createdTasks.length > 0) {
            setAssignedTasks(prev => [...createdTasks, ...prev]);
            setSuccessMessage(`Task assigned to ${createdTasks.length} member${createdTasks.length > 1 ? 's' : ''} successfully!`);

            // Log activity
            await logActivity({
                member_id: currentMember.member_id,
                member_name: formatName(currentMember.name),
                action: 'task_assigned',
                details: `Assigned task "${taskTitle}" to ${assigneeNames}`,
                target_type: 'task',
                target_id: createdTasks[0].id
            });

            // Reset form
            setSelectedMembers([]);
            setTaskTitle('');
            setTaskDescription('');
            setTaskPriority('medium');
            setTaskCategory('');
            setTaskDueDate('');
            setShowForm(false);
            setTimeout(() => setSuccessMessage(''), 3000);
        }
        setIsSubmitting(false);
    };

    const handleDeleteTask = async (taskId: string) => {
        const success = await deleteTask(taskId);
        if (success) {
            setAssignedTasks(prev => prev.filter(t => t.id !== taskId));
            // Refresh notifications if NotificationsTab is present
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new Event('refresh-notifications'));
            }
        }
        setDeleteConfirm({ show: false, taskId: '', taskTitle: '' });
    };

    const confirmDelete = (taskId: string, taskTitle: string) => {
        setDeleteConfirm({ show: true, taskId, taskTitle });
    };

    const getMemberName = (memberId: string) => {
        const member = members.find(m => m.member_id === memberId);
        return member?.name || memberId;
    };

    // Helper function to check if member belongs to a division
    // Supports multiple divisions stored as comma-separated values (e.g., "Rocketry, Creative/Web-Dev")
    const memberMatchesDivision = (memberDivision: string | null | undefined, filterDivision: string): boolean => {
        if (!memberDivision) return false;

        // Split member's divisions by comma and check each one
        const memberDivisions = memberDivision.split(',').map(d => d.toLowerCase().trim());
        const filterDiv = filterDivision.toLowerCase().trim();

        return memberDivisions.some(div => {
            // Handle different division name variations
            if (filterDiv === 'drone') {
                return div.includes('drone');
            } else if (filterDiv === 'rc plane') {
                return div.includes('rc') || div.includes('plane');
            } else if (filterDiv === 'rocketry') {
                return div.includes('rocket');
            } else if (filterDiv === 'management') {
                return div.includes('manage');
            } else if (filterDiv === 'creative/web-dev') {
                return div.includes('creative') || div.includes('web');
            } else {
                return div.includes(filterDiv);
            }
        });
    };

    // ROBUST FIX: Filter members based on year, division, and search filters
    // Search filters by name and member ID (respects all active filters)
    // This calculation is placed inline (not memoized) to ensure it always reflects current state
    const filteredMembers = members.filter(member => {
        // Year filter - handle null/undefined years
        let yearMatch = yearFilter === 'all';
        if (!yearMatch && member.year != null) {
            yearMatch = member.year === yearFilter;
        }

        // Division filter - supports multiple divisions per member
        const divisionMatch = divisionFilter === 'all' || memberMatchesDivision(member.division, divisionFilter);

        // Search filter - matches name or member ID (case-insensitive)
        // CRITICAL: Normalize search term and trim whitespace for consistent matching
        const searchTerm = memberSearch.trim().toLowerCase();
        const nameMatch = member.name.trim().toLowerCase();
        const idMatch = member.member_id.trim().toLowerCase();

        // Empty search term matches all, otherwise check for substring matches in both name and ID
        const searchMatch = searchTerm === '' ||
            nameMatch.includes(searchTerm) ||
            idMatch.includes(searchTerm);

        return yearMatch && divisionMatch && searchMatch;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Assign Tasks</h1>
                    <p className="text-white/50 text-sm mt-1">Create and manage task assignments for team members</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors font-medium"
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'New Task'}
                </button>
            </div>

            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-green-400"
                    >
                        <CheckCircle2 size={18} />
                        {successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* New Task Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-xl border border-white/10 p-6 space-y-5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Send size={18} className="text-blue-400" />
                                Assign New Task
                            </h2>

                            {/* Member Selection - Multi Select */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Assign To * <span className="text-white/40">(Select one or more members)</span>
                                </label>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {/* Year Filter - Only years 1-3 can be assigned tasks (4th year and alumni excluded) */}
                                    <select
                                        value={yearFilter}
                                        onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="all">All Years</option>
                                        <option value="1">1st Year</option>
                                        <option value="2">2nd Year</option>
                                        <option value="3">3rd Year</option>
                                    </select>

                                    {/* Division Filter */}
                                    <select
                                        value={divisionFilter}
                                        onChange={(e) => setDivisionFilter(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="all">All Divisions</option>
                                        {divisionOptions.map(div => (
                                            <option key={div} value={div}>{div}</option>
                                        ))}
                                    </select>

                                    {/* Reset Filters - shows when any filter is active (including search) */}
                                    {(yearFilter !== 'all' || divisionFilter !== 'all' || memberSearch !== '') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setYearFilter('all');
                                                setDivisionFilter('all');
                                                setMemberSearch('');
                                            }}
                                            className="text-xs px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-colors"
                                        >
                                            Reset Filters
                                        </button>
                                    )}

                                    <span className="text-xs text-white/40 ml-auto self-center">
                                        {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} shown
                                    </span>
                                </div>

                                {/* Member selection dropdown - slightly larger with smooth scrolling and integrated search */}
                                <div
                                    className="bg-white/5 border border-white/10 rounded-lg p-4 max-h-72 overflow-y-auto space-y-2"
                                    style={{
                                        overflowY: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                        touchAction: 'pan-y',
                                        scrollBehavior: 'smooth'
                                    }}
                                    onWheel={(e) => {
                                        e.stopPropagation();
                                        const target = e.currentTarget;
                                        target.scrollTop += e.deltaY;
                                    }}
                                >
                                    {/* Search input inside dropdown - filters by name and member ID */}
                                    <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm pb-2 mb-2 border-b border-white/10 -mt-1 pt-1">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                            <input
                                                type="text"
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                                placeholder="Search by name or ID..."
                                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                                            />
                                            {memberSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setMemberSearch('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Select All / Deselect All */}
                                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMembers(prev => {
                                                const filteredIds = filteredMembers.map(m => m.member_id);
                                                const newSelected = [...new Set([...prev, ...filteredIds])];
                                                return newSelected;
                                            })}
                                            className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                                        >
                                            Select Filtered
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMembers([])}
                                            className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded transition-colors"
                                        >
                                            Clear All
                                        </button>
                                        <span className="text-xs text-white/40 ml-auto">
                                            {selectedMembers.length} selected
                                        </span>
                                    </div>
                                    {filteredMembers.length === 0 ? (
                                        <p className="text-white/40 text-sm text-center py-4">No members match the selected filters</p>
                                    ) : (
                                        filteredMembers.map(member => (
                                            <label
                                                key={member.member_id}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${selectedMembers.includes(member.member_id)
                                                    ? 'bg-blue-500/20 border border-blue-500/30'
                                                    : 'hover:bg-white/5 border border-transparent'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMembers.includes(member.member_id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedMembers(prev => [...prev, member.member_id]);
                                                        } else {
                                                            setSelectedMembers(prev => prev.filter(id => id !== member.member_id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm truncate">{formatName(member.name)}</p>
                                                    <p className="text-white/40 text-xs truncate">
                                                        {member.member_id} • {member.division} • {member.year === 1 ? '1st' : member.year === 2 ? '2nd' : member.year === 3 ? '3rd' : member.year === 4 ? '4th' : '5th'} Year
                                                    </p>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                                {selectedMembers.length === 0 && (
                                    <p className="text-red-400/70 text-xs mt-1">Please select at least one member</p>
                                )}
                            </div>

                            {/* Task Title */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Task Title *
                                </label>
                                <input
                                    type="text"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    placeholder="Enter task title..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                                    required
                                />
                            </div>

                            {/* Task Description */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={taskDescription}
                                    onChange={(e) => setTaskDescription(e.target.value)}
                                    placeholder="Add more details about the task..."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                                />
                            </div>

                            {/* Priority, Category, Due Date Row */}
                            <div className="grid sm:grid-cols-3 gap-4">
                                {/* Priority */}
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Priority *
                                    </label>
                                    <select
                                        value={taskPriority}
                                        onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Category *
                                    </label>
                                    <select
                                        value={taskCategory}
                                        onChange={(e) => setTaskCategory(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                        required
                                    >
                                        <option value="">Select...</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={taskDueDate}
                                        onChange={(e) => setTaskDueDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3 rounded-lg uppercase tracking-wider text-sm hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Assign Task
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assigned Tasks List */}
            <div className="bg-gray-800/30 rounded-xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-white font-bold">Tasks You've Assigned</h2>
                    <span className="text-xs text-white/40 font-mono">{assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''}</span>
                </div>

                {assignedTasks.length === 0 ? (
                    <div className="px-5 py-12 text-center text-white/40">
                        <Send size={48} className="mx-auto mb-4 opacity-30" />
                        <p>No tasks assigned yet</p>
                        <p className="text-sm mt-1">Click "New Task" to assign a task to a team member</p>
                    </div>
                ) : (
                    <div
                        className="divide-y divide-white/5 max-h-[400px] overflow-y-auto"
                        style={{
                            overflowY: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            touchAction: 'pan-y',
                            scrollBehavior: 'smooth'
                        }}
                        onWheel={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget;
                            target.scrollTop += e.deltaY;
                        }}
                    >
                        {assignedTasks.map((task) => (
                            <div key={task.id} className="px-5 py-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {task.status === 'completed' ? (
                                            <CheckCircle2 size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                                        ) : task.status === 'in-progress' ? (
                                            <Clock size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <Circle size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{task.title}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    To: {getMemberName(task.assigned_to)}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/50">
                                                    {task.category}
                                                </span>
                                                <span className="text-white/40 text-[10px]">
                                                    Due: {new Date(task.due_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => confirmDelete(task.id, task.title)}
                                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                                        title="Delete task"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm.show && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setDeleteConfirm({ show: false, taskId: '', taskTitle: '' })}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                    <AlertTriangle size={24} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Delete Task?</h3>
                                    <p className="text-white/50 text-sm">This action cannot be undone</p>
                                </div>
                            </div>

                            <p className="text-white/70 mb-6">
                                Are you sure you want to delete "<span className="text-white font-medium">{deleteConfirm.taskTitle}</span>"?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm({ show: false, taskId: '', taskTitle: '' })}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(deleteConfirm.taskId)}
                                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Add Member Tab - For Council Members to add new members
const AddMemberTab = ({ currentMember }: { currentMember: Member }) => {
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Check if current user is UDAAN-000 (super admin)
    const isSuperAdminUser = currentMember.member_id === 'UDAAN-000';

    // Form fields - role is always 'Member' by default (or 'Alumni' for UDAAN-000)
    const [name, setName] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [password, setPassword] = useState('');
    const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
    const [year, setYear] = useState<number>(2);
    const [isAlumni, setIsAlumni] = useState(false); // Only for UDAAN-000

    // Auto-derived fields from roll number
    const [department, setDepartment] = useState('');
    const [instituteEmail, setInstituteEmail] = useState('');
    const [detectedDeptCode, setDetectedDeptCode] = useState('');

    // Department codes mapping
    const DEPARTMENT_CODES: { [key: string]: string } = {
        'AR': 'Architecture',
        'BM': 'Biomedical Engineering',
        'BT': 'Biotechnology & Medical Engineering',
        'CE': 'Civil Engineering',
        'CH': 'Chemical Engineering',
        'CR': 'Ceramic Engineering',
        'CS': 'Computer Science & Engineering',
        'CY': 'Department of Chemistry',
        'EC': 'Electronics & Communication Engineering',
        'EE': 'Electrical Engineering',
        'EI': 'Electronics & Instrumentation Engineering',
        'ER': 'Earth and Atmospheric Sciences',
        'FP': 'Food Process Engineering',
        'ID': 'Industrial Design',
        'LS': 'Life Science',
        'MA': 'Department of Mathematics',
        'ME': 'Mechanical Engineering',
        'MM': 'Metallurgical & Materials Engineering',
        'MN': 'Mining Engineering',
        'PH': 'Department of Physics and Astronomy',
        'PI': 'Production Engineering'
    };

    // Auto-detect department and generate institute email from roll number
    useEffect(() => {
        if (rollNo.length >= 5) {
            const deptCode = rollNo.substring(3, 5).toUpperCase();
            setDetectedDeptCode(deptCode);
            if (DEPARTMENT_CODES[deptCode]) {
                setDepartment(DEPARTMENT_CODES[deptCode]);
            } else {
                setDepartment('');
            }
            // Generate institute email
            if (rollNo.length === 9) {
                setInstituteEmail(`${rollNo.toLowerCase()}@nitrkl.ac.in`);
            } else {
                setInstituteEmail('');
            }
        } else {
            setDepartment('');
            setInstituteEmail('');
            setDetectedDeptCode('');
        }
    }, [rollNo]);

    const divisions = ['Drone', 'RC Plane', 'Rocketry', 'Management', 'Creative/Web-Dev'];

    const toggleDivision = (div: string) => {
        setSelectedDivisions(prev =>
            prev.includes(div)
                ? prev.filter(d => d !== div)
                : [...prev, div]
        );
    };

    const resetForm = () => {
        setName('');
        setRollNo('');
        setPassword('');
        setSelectedDivisions([]);
        setYear(2);
        setDepartment('');
        setInstituteEmail('');
        setDetectedDeptCode('');
        setErrorMessage('');
        setIsAlumni(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDivisions.length === 0) {
            setErrorMessage('Please select at least one division');
            return;
        }

        // For Alumni (only UDAAN-000 can add), skip roll number validation
        if (!isAlumni) {
            if (rollNo.length !== 9) {
                setErrorMessage('Roll number must be 9 characters (e.g., 121CS0XXX)');
                return;
            }
            if (!department) {
                setErrorMessage('Could not detect department from roll number. Please check the roll number.');
                return;
            }
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            // Join multiple divisions with comma
            const divisionString = selectedDivisions.join(', ');

            // If adding alumni (only UDAAN-000 can do this)
            if (isAlumni && isSuperAdminUser) {
                const { addAlumniMember } = await import('../utils/supabase');
                const result = await addAlumniMember(currentMember.member_id, {
                    name,
                    email: instituteEmail || `${name.toLowerCase().replace(/\s+/g, '.')}@alumni.nitrkl.ac.in`,
                    password,
                    division: divisionString,
                    department: department || undefined,
                    roll_no: rollNo || undefined
                });

                if (result.success && result.member) {
                    setSuccessMessage(`Successfully added alumni ${name} with ID: ${result.member.member_id}`);
                    resetForm();
                    setShowForm(false);
                    setTimeout(() => setSuccessMessage(''), 5000);
                } else {
                    setErrorMessage(result.message || 'Failed to add alumni.');
                }
            } else {
                // Regular member addition
                const result = await addMemberWithYear({
                    name,
                    email: instituteEmail, // Auto-generated institute email
                    password,
                    role: 'Member', // All new members are added as 'Member' by default
                    division: divisionString,
                    year,
                    added_by: currentMember.member_id,
                    isCouncil: false, // New members added here are regular members, not council
                    roll_no: rollNo.toUpperCase(),
                    department: department,
                    institute_email: instituteEmail
                });

                if (result.success && result.member) {
                    setSuccessMessage(`Successfully added ${name} with ID: ${result.member.member_id}`);
                    resetForm();
                    setShowForm(false);
                    setTimeout(() => setSuccessMessage(''), 5000);
                } else {
                    setErrorMessage(result.error || 'Failed to add member. Please try again.');
                }
            }
        } catch (error) {
            setErrorMessage('An error occurred. Please try again.');
            console.error('Error adding member:', error);
        }

        setIsSubmitting(false);
    };

    const getIdFormatPreview = () => {
        if (isAlumni) return 'A-XXXX';
        switch (year) {
            case 1: return 'UDAAN-1XXX';
            case 2: return 'UDAAN-2XXX';
            case 3: return 'UDAAN-3XXX';
            case 4: return 'UDAAN-4XXX';
            default: return 'UDAAN-XXX';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{isAlumni ? 'Add Alumni' : 'Add Member'}</h1>
                    <p className="text-white/50 text-sm mt-1">{isAlumni ? 'Add alumni to the Udaan records' : 'Add new members to the Udaan team'}</p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        if (!showForm) resetForm();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg transition-colors font-medium"
                >
                    {showForm ? <X size={18} /> : <UserPlus size={18} />}
                    {showForm ? 'Cancel' : 'Add Member'}
                </button>
            </div>

            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-green-400"
                    >
                        <CheckCircle2 size={18} />
                        {successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
                {errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-red-400"
                    >
                        <AlertCircle size={18} />
                        {errorMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Member Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-xl border border-white/10 p-6 space-y-5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlus size={18} className={isAlumni ? 'text-orange-400' : 'text-green-400'} />
                                {isAlumni ? 'New Alumni Details' : 'New Member Details'}
                            </h2>

                            {/* UDAAN-000 can toggle between Member and Alumni */}
                            {isSuperAdminUser && (
                                <div className="flex gap-2 p-2 bg-black/30 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setIsAlumni(false)}
                                        className={`flex-1 py-2 rounded-lg transition-all font-medium text-sm ${!isAlumni
                                            ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                            : 'text-white/50 hover:text-white/70'
                                            }`}
                                    >
                                        Add Member
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAlumni(true)}
                                        className={`flex-1 py-2 rounded-lg transition-all font-medium text-sm ${isAlumni
                                            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                                            : 'text-white/50 hover:text-white/70'
                                            }`}
                                    >
                                        Add Alumni
                                    </button>
                                </div>
                            )}

                            {/* Year Selection - Only for Members, not Alumni */}
                            {!isAlumni && (
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Year of Study *
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 4].map((y) => (
                                            <button
                                                key={y}
                                                type="button"
                                                onClick={() => setYear(y)}
                                                className={`py-3 rounded-lg border transition-all font-medium text-sm ${year === y
                                                    ? y === 1 ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                                                        : 'bg-green-500/20 border-green-500/50 text-green-400'
                                                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                                                    }`}
                                            >
                                                {y === 1 ? '1st Year' : y === 2 ? '2nd Year' : y === 3 ? '3rd Year' : '4th Year'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-white/40 text-xs mt-2">
                                        ID Format: <span className="text-green-400 font-mono">{getIdFormatPreview()}</span>
                                    </p>
                                </div>
                            )}

                            {/* Alumni ID Format notice */}
                            {isAlumni && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                                    <p className="text-orange-400 text-sm flex items-center gap-2">
                                        <User size={16} />
                                        Alumni ID Format: <span className="font-mono">{getIdFormatPreview()}</span>
                                    </p>
                                    <p className="text-white/50 text-xs mt-1">Alumni IDs are permanent and never reused</p>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={isAlumni ? "Enter alumni's full name..." : "Enter member's full name..."}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 transition-all"
                                    required
                                />
                            </div>

                            {/* Roll Number - Optional for Alumni */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Roll Number {!isAlumni && '*'} {isAlumni && <span className="text-white/40 normal-case">(Optional for alumni)</span>}
                                </label>
                                <input
                                    type="text"
                                    value={rollNo}
                                    onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                                    placeholder="e.g., 123CS1234"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 transition-all font-mono"
                                    required={!isAlumni}
                                />
                                {detectedDeptCode && (
                                    <p className="text-green-400/60 text-xs mt-1">
                                        Detected: {DEPARTMENT_CODES[detectedDeptCode]} ({detectedDeptCode})
                                    </p>
                                )}
                            </div>

                            {/* Department (Auto-detected) */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Department <span className="text-white/40 normal-case">(Auto-detected from Roll No.)</span>
                                </label>
                                <input
                                    type="text"
                                    value={department}
                                    readOnly
                                    placeholder={isAlumni && !rollNo ? "Optional - enter roll number to auto-detect" : "Will be detected from roll number..."}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/60 placeholder:text-white/30 cursor-not-allowed"
                                />
                            </div>

                            {/* Institute Email (Auto-generated) */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    {isAlumni ? 'Email' : 'Institute Email'} <span className="text-white/40 normal-case">(Auto-generated)</span>
                                </label>
                                <input
                                    type="email"
                                    value={instituteEmail}
                                    readOnly
                                    placeholder={isAlumni ? "Will be generated from name..." : "Will be generated from roll number..."}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/60 placeholder:text-white/30 cursor-not-allowed"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Password *
                                </label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Set initial password..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 transition-all font-mono"
                                    required
                                />
                                <p className="text-white/40 text-xs mt-1">This will be the member's login password</p>
                            </div>

                            {/* Division - Multiple Selection */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Division(s) * <span className="text-white/40 normal-case">(Select one or more)</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {divisions.map(div => (
                                        <button
                                            key={div}
                                            type="button"
                                            onClick={() => toggleDivision(div)}
                                            className={`px-3 py-2 rounded-lg border text-sm transition-all ${selectedDivisions.includes(div)
                                                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
                                                }`}
                                        >
                                            {div}
                                        </button>
                                    ))}
                                </div>
                                {selectedDivisions.length > 0 && (
                                    <p className="text-green-400/70 text-xs mt-2">
                                        Selected: {selectedDivisions.join(', ')}
                                    </p>
                                )}
                                <p className="text-white/40 text-xs mt-1">All new members are added with role "Member"</p>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-3 rounded-lg uppercase tracking-wider text-sm hover:from-green-500 hover:to-green-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Adding Member...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={18} />
                                        Add Member
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info Card */}
            <div className="bg-gray-800/30 rounded-xl border border-white/5 p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-blue-400" />
                    Member ID Format Guide
                </h2>
                <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded">UDAAN-XXX</span>
                        <span className="text-white/60">→ Council Members (existing)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded">UDAAN-2XXX</span>
                        <span className="text-white/60">→ 2nd Year Members</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-green-400 bg-green-500/10 px-3 py-1 rounded">UDAAN-3XXX</span>
                        <span className="text-white/60">→ 3rd Year Members</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-purple-400 bg-purple-500/10 px-3 py-1 rounded">UDAAN-4XXX</span>
                        <span className="text-white/60">→ 4th Year Members</span>
                    </div>
                </div>
                <p className="text-white/40 text-xs mt-4">
                    Member IDs are auto-generated based on year of study.
                </p>
            </div>
        </div>
    );
};

// Announcements Tab - For council to create and manage announcements
const AnnouncementsTab = ({
    announcements,
    onAddAnnouncement,
    onDeleteAnnouncement
}: {
    announcements: Announcement[];
    onAddAnnouncement: (announcement: Announcement) => void;
    onDeleteAnnouncement: (id: string) => void;
}) => {
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'meeting' | 'update' | 'deadline' | 'important'>('update');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const resetForm = () => {
        setTitle('');
        setContent('');
        setType('update');
        setDate(new Date().toISOString().split('T')[0]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const newAnnouncement: Announcement = {
            id: String(Date.now()),
            title,
            content,
            date,
            type,
            createdBy: 'Council'
        };

        onAddAnnouncement(newAnnouncement);
        resetForm();
        setShowForm(false);
        setSuccessMessage('Announcement published successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        setIsSubmitting(false);
    };

    const getTypeColor = (announcementType: string) => {
        switch (announcementType) {
            case 'meeting': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
            case 'deadline': return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'important': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            default: return 'text-green-400 bg-green-500/10 border-green-500/30';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Announcements</h1>
                    <p className="text-white/50 text-sm mt-1">Create and manage announcements visible to all members</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${showForm ? 'bg-red-500 hover:bg-red-400' : 'bg-blue-500 hover:bg-blue-400'
                        }`}
                >
                    {showForm ? <X size={16} /> : <Plus size={16} />}
                    {showForm ? 'Cancel' : 'New Announcement'}
                </button>
            </div>

            {/* Success Message */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2 text-green-400"
                    >
                        <CheckCircle2 size={18} />
                        {successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Announcement Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-xl border border-white/10 p-5 space-y-4">
                            <h3 className="text-white font-medium flex items-center gap-2">
                                <Bell size={18} className="text-blue-400" />
                                New Announcement
                            </h3>

                            {/* Title */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Announcement title..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                                    required
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                    Content *
                                </label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Write your announcement here..."
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                                    required
                                />
                            </div>

                            {/* Type and Date */}
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Type *
                                    </label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as 'meeting' | 'update' | 'deadline' | 'important')}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                    >
                                        <option value="update">Update</option>
                                        <option value="meeting">Meeting</option>
                                        <option value="deadline">Deadline</option>
                                        <option value="important">Important</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">
                                        Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Bell size={18} />
                                        Publish Announcement
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Announcements List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white/60 text-sm font-medium">All Announcements ({announcements.length})</h2>
                </div>

                {announcements.length === 0 ? (
                    <div className="bg-gray-800/30 rounded-xl border border-white/5 p-8 text-center">
                        <Bell size={40} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40">No announcements yet</p>
                        <p className="text-white/30 text-sm mt-1">Create one to notify all members</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {announcements.map((ann) => (
                            <motion.div
                                key={ann.id}
                                layout
                                className="bg-gray-800/50 rounded-xl border border-white/5 overflow-hidden"
                            >
                                <div
                                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => setExpandedId(expandedId === ann.id ? null : ann.id)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${ann.type === 'meeting' ? 'bg-blue-400' :
                                                ann.type === 'deadline' ? 'bg-red-400' :
                                                    ann.type === 'important' ? 'bg-yellow-400' : 'bg-green-400'
                                                }`}></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium">{ann.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${getTypeColor(ann.type)}`}>
                                                        {ann.type}
                                                    </span>
                                                    <span className="text-white/40 text-xs">{new Date(ann.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight
                                            size={18}
                                            className={`text-white/30 transition-transform ${expandedId === ann.id ? 'rotate-90' : ''}`}
                                        />
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {expandedId === ann.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="border-t border-white/5"
                                        >
                                            <div className="p-4 space-y-4">
                                                <div className="bg-white/5 rounded-lg p-4">
                                                    <label className="text-white/40 text-xs uppercase tracking-wider">Content</label>
                                                    <p className="text-white/70 mt-1 text-sm whitespace-pre-wrap">{ann.content}</p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white/40 text-xs">Posted by: {ann.createdBy}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteAnnouncement(ann.id);
                                                            setExpandedId(null);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Notifications Tab Component
const NotificationsTab = ({
    memberId,
    onMarkAsRead,
    onMarkAllAsRead
}: {
    memberId: string;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
}) => {
    const [notifications, setNotifications] = useState<SupabaseNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            setIsLoading(true);
            const data = await getNotifications(memberId, filter === 'unread');
            setNotifications(data);
            setIsLoading(false);
        };
        fetchNotifications();

        // Listen for refresh-notifications event
        const handler = () => fetchNotifications();
        window.addEventListener('refresh-notifications', handler);
        return () => {
            window.removeEventListener('refresh-notifications', handler);
        };
    }, [memberId, filter]);

    const handleMarkAsRead = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        onMarkAsRead(id);
    };

    const handleNotificationClick = (notification: SupabaseNotification) => {
        // Toggle expand/collapse
        setExpandedId(prev => prev === notification.id ? null : notification.id);
        // Mark as read if not already
        if (!notification.read) {
            handleMarkAsRead(notification.id);
        }
    };

    const handleMarkAllAsRead = async () => {
        await markAllNotificationsAsRead(memberId);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        onMarkAllAsRead();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'task_assigned': return <ClipboardList size={18} className="text-blue-400" />;
            case 'task_updated': return <CheckCircle2 size={18} className="text-green-400" />;
            case 'announcement': return <MessageSquare size={18} className="text-purple-400" />;
            case 'mention': return <User size={18} className="text-yellow-400" />;
            case 'reminder': return <Clock size={18} className="text-orange-400" />;
            default: return <Bell size={18} className="text-gray-400" />;
        }
    };

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Notifications</h1>
                    <p className="text-white/50 text-sm mt-1">
                        {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Filter Toggle */}
                    <div className="flex bg-white/5 rounded-lg p-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${filter === 'all' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${filter === 'unread' ? 'bg-blue-500 text-white' : 'text-white/60 hover:text-white'
                                }`}
                        >
                            Unread
                        </button>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors text-sm"
                        >
                            <CheckCircle2 size={16} />
                            Mark all read
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Bell size={32} className="text-white/20" />
                    </div>
                    <h3 className="text-white/60 text-lg font-medium">No notifications</h3>
                    <p className="text-white/40 text-sm mt-1">
                        {filter === 'unread' ? 'All notifications have been read' : "You're all caught up!"}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((notification) => (
                        <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-white/5 rounded-xl border transition-all cursor-pointer hover:bg-white/10 ${notification.read ? 'border-white/5' : 'border-blue-500/30 bg-blue-500/5'
                                }`}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <div className="p-4 flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notification.read ? 'bg-white/5' : 'bg-blue-500/20'
                                    }`}>
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className={`font-medium ${notification.read ? 'text-white/70' : 'text-white'}`}>
                                            {notification.title}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {!notification.read && (
                                                <span className="w-2 h-2 bg-blue-400 rounded-full mt-2"></span>
                                            )}
                                            <ChevronDown
                                                size={16}
                                                className={`text-white/40 transition-transform ${expandedId === notification.id ? 'rotate-180' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Expandable Description */}
                                    <AnimatePresence>
                                        {expandedId === notification.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 pt-3 border-t border-white/10">
                                                    <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {notification.message}
                                                    </p>
                                                    <span className="text-white/30 text-xs mt-3 block">
                                                        {new Date(notification.created_at).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Main Dashboard Component
// Council-only: Induction Applications tab
const JoinCorpsApplicationsTab = ({ currentMember }: { currentMember: Member }) => {
    const [applicants, setApplicants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeYears, setActiveYears] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isRemoving, setIsRemoving] = useState(false);

    // Permission guard: only council members may view/export applicants
    const isCouncil = currentMember.clearance === 5;

    useEffect(() => {
        if (!isCouncil) return; // safety: do nothing for non-council

        let mounted = true;
        const fetchConfigAndApplicants = async () => {
            try {
                // Fetch which inductions are active from public config (admin toggles)
                const res = await fetch('/config.json');
                const cfg = await (res.ok ? res.json() : Promise.resolve({}));
                const years: string[] = [];
                if (cfg?.induction1stYearOpen) years.push('1st Year');
                if (cfg?.induction2ndYearOpen) years.push('2nd Year');
                if (mounted) setActiveYears(years);

                // Fetch applicants from Supabase util and filter by active years
                const all = await getApplicants();
                const filtered = all.filter(a => years.length === 0 ? false : years.includes(a.year));
                if (mounted) setApplicants(filtered);
            } catch (err) {
                if (mounted) setApplicants([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchConfigAndApplicants();
        return () => { mounted = false; };
    }, [currentMember]);

    // Generate and trigger XLSX download using SheetJS
    const handleExport = () => {
        if (!isCouncil) return; // extra safety

        // Prepare rows with required columns
        const rows = applicants.map(a => ({
            Name: a.name,
            Email: a.email,
            Phone: a.phone,
            'Roll Number': a.roll_no,
            Year: a.year,
            Department: a.department,
            'Selected Divisions': Array.isArray(a.interests) ? a.interests.join(', ') : a.interests || '',
            Experience: a.experience,
            Motivation: a.why_join,
            'Application Timestamp': a.created_at
        }));

        // Create workbook and trigger download (UTF-8 safe .xlsx)
        const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Induction Applications');
        const filename = `join_corps_applications_${new Date().getFullYear()}.xlsx`;
        XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
    };

    // Council members can remove selected candidates
    const canRemoveCandidates = currentMember.clearance >= 5;

    const handleRemoveSelected = async () => {
        if (!canRemoveCandidates || selectedIds.length === 0) return;

        if (!window.confirm(`Are you sure you want to remove ${selectedIds.length} candidate(s)? This will permanently delete their accounts and they won't be able to login anymore.`)) {
            return;
        }

        setIsRemoving(true);
        try {
            // Get the roll numbers of selected applicants to find corresponding members
            const selectedApplicants = applicants.filter(a => selectedIds.includes(a.id));

            for (const applicant of selectedApplicants) {
                // Delete from members table (if exists) - this removes login credentials
                const { error: memberError } = await supabase
                    .from('members')
                    .delete()
                    .ilike('name', applicant.name)
                    .eq('status', 'provisional');

                if (memberError) console.error('Error deleting member:', memberError);

                // Delete from applicants table
                const { error: applicantError } = await supabase
                    .from('applicants')
                    .delete()
                    .eq('id', applicant.id);

                if (applicantError) console.error('Error deleting applicant:', applicantError);
            }

            // Refresh the list
            const all = await getApplicants();
            const filtered = all.filter(a => activeYears.length === 0 ? false : activeYears.includes(a.year));
            setApplicants(filtered);
            setSelectedIds([]);
            alert(`Successfully removed ${selectedApplicants.length} candidate(s).`);
        } catch (err) {
            console.error('Error removing candidates:', err);
            alert('Error removing candidates. Please try again.');
        } finally {
            setIsRemoving(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === applicants.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(applicants.map(a => a.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        );
    };

    if (!isCouncil) return null; // never render for non-council

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    // If induction is not active, do not expose the section
    if (!activeYears || activeYears.length === 0) {
        return (
            <div className="p-6 bg-gray-800/20 rounded-lg">Induction is not active.</div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-white text-lg font-bold">Induction Applications</h2>
                    {canRemoveCandidates && selectedIds.length > 0 && (
                        <span className="text-white/50 text-sm">({selectedIds.length} selected)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canRemoveCandidates && selectedIds.length > 0 && (
                        <button
                            onClick={handleRemoveSelected}
                            disabled={isRemoving}
                            className="px-4 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isRemoving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Removing...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} />
                                    Remove Selected
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-nation-secondary text-white rounded-md text-sm hover:bg-white hover:text-black transition-colors"
                    >
                        Export as Sheet
                    </button>
                </div>
            </div>

            <div className="overflow-auto bg-gray-800/20 rounded-lg border border-white/5">
                <table className="min-w-full text-left">
                    <thead>
                        <tr className="text-white/60 text-xs">
                            {canRemoveCandidates && (
                                <th className="px-4 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === applicants.length && applicants.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-white/30 bg-transparent cursor-pointer"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-2">S.No</th>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Phone</th>
                            <th className="px-4 py-2">Roll Number</th>
                            <th className="px-4 py-2">Year</th>
                            <th className="px-4 py-2">Department</th>
                            <th className="px-4 py-2">Selected Divisions</th>
                            <th className="px-4 py-2">Experience</th>
                            <th className="px-4 py-2">Motivation</th>
                            <th className="px-4 py-2">Application Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {applicants.map((a, index) => (
                            <tr key={a.id} className={`border-t border-white/5 ${selectedIds.includes(a.id) ? 'bg-red-500/10' : 'even:bg-black/5'}`}>
                                {canRemoveCandidates && (
                                    <td className="px-4 py-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(a.id)}
                                            onChange={() => toggleSelectOne(a.id)}
                                            className="w-4 h-4 rounded border-white/30 bg-transparent cursor-pointer"
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-2 text-sm text-white/40">{index + 1}</td>
                                <td className="px-4 py-2 text-sm text-white">{a.name}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.email}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.phone}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.roll_no}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.year}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.department}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{Array.isArray(a.interests) ? a.interests.join(', ') : a.interests}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.experience}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.why_join}</td>
                                <td className="px-4 py-2 text-sm text-white/60">{a.created_at}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const MemberDashboard = ({ member, onLogout }: { member: Member; onLogout: () => void }) => {
    const isProvisional = member.status === 'provisional';
    const [activeTab, setActiveTab] = useState(isProvisional ? 'whatsapp-group' : 'dashboard');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [pendingDivisionRequestsCount, setPendingDivisionRequestsCount] = useState(0);
    const [inductionActive, setInductionActive] = useState(false);

    // President bulk email modal state
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [applicantsList, setApplicantsList] = useState<any[]>([]);
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
    const [bulkResults, setBulkResults] = useState<Array<{ email: string; success: boolean; message?: string }>>([]);

    // Fetch induction active flag for mobile UI and conditional tabs
    useEffect(() => {
        let mounted = true;
        fetch('/config.json')
            .then(r => r.ok ? r.json() : Promise.reject('no config'))
            .then(data => {
                if (!mounted) return;
                setInductionActive(Boolean(data?.induction1stYearOpen || data?.induction2ndYearOpen));
            })
            .catch(() => {
                if (!mounted) return;
                setInductionActive(false);
            });
        return () => { mounted = false; };
    }, []);

    // Open modal and load current applicants
    const openEmailModal = async () => {
        try {
            const apps = await getApplicants('pending');
            const list = Array.isArray(apps) ? apps : [];
            setApplicantsList(list);
            setBulkResults([]);
            setBulkProgress({ done: 0, total: list.length });
            // default: select only applicants with verified email
            const ids = list.filter((a: any) => a.email_verified).map((a: any) => a.id).filter(Boolean);
            setSelectedApplicantIds(ids);
            setShowEmailModal(true);
        } catch (err) {
            console.error('Failed to load applicants:', err);
            alert('Failed to load applicants. See console for details.');
        }
    };

    // Promote each applicant to Stage 2 (creates member id + temp password) and send credentials email
    const promoteAndEmailAll = async () => {
        const targets = applicantsList.filter(a => selectedApplicantIds.includes(a.id));
        if (targets.length === 0) { alert('No applicants selected'); return; }
        if (!confirm(`Promote ${targets.length} selected applicants to Stage 2 and email credentials? This will create member records.`)) return;
        setIsBulkProcessing(true);
        setBulkResults([]);
        setBulkProgress({ done: 0, total: targets.length });

        const results: Array<{ email: string; success: boolean; message?: string }> = [];

        for (let i = 0; i < targets.length; i++) {
            const app = targets[i];
            try {
                // promoteApplicantToStage2 returns { success, member, tempPassword }
                const res = await promoteApplicantToStage2(app.id, member.member_id);
                if (!res || !res.success || !res.member) {
                    // Check if already promoted - try to find existing member and resend email
                    const errorMsg = res?.error || 'Promotion failed';
                    if (errorMsg.includes('already exists')) {
                        // Extract member info from error and allow resending
                        results.push({ email: app.email, success: false, message: errorMsg });
                    } else {
                        results.push({ email: app.email, success: false, message: errorMsg });
                    }
                } else {
                    // Send credentials email (non-blocking: promotion succeeds even if email fails)
                    try {
                        const emailed = await sendCredentialsEmail(app.email, app.name, res.member.member_id, res.tempPassword || '');
                        if (emailed) {
                            results.push({ email: app.email, success: true });
                        } else {
                            // Email failed but promotion succeeded - still mark as success with note
                            results.push({ email: app.email, success: true, message: 'Promoted (email may have failed)' });
                        }
                    } catch {
                        // Email exception - promotion still succeeded
                        results.push({ email: app.email, success: true, message: 'Promoted (email error)' });
                    }
                }
            } catch (err) {
                console.error('Promotion error for', app.email, err);
                results.push({ email: app.email, success: false, message: 'Exception' });
            }
            setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
        }

        setBulkResults(results);
        setIsBulkProcessing(false);
    };

    // Clean up old notifications (older than 7 days) on mount
    useEffect(() => {
        const cleanupNotifications = async () => {
            await deleteOldNotifications(7); // Delete notifications older than 1 week
        };
        cleanupNotifications();
    }, []);

    // Fetch notification count
    useEffect(() => {
        const fetchNotificationCount = async () => {
            const count = await getUnreadNotificationCount(member.member_id);
            setUnreadNotificationCount(count);
        };
        fetchNotificationCount();
        // Refresh count every 30 seconds
        const interval = setInterval(fetchNotificationCount, 30000);
        return () => clearInterval(interval);
    }, [member.member_id]);

    // Fetch pending division requests count (for council/division heads)
    useEffect(() => {
        const isCouncil = member.clearance === 5;
        const isDivisionHead = Object.values(DIVISION_HEADS).some(h => h.member_id === member.member_id);

        if (!isCouncil && !isDivisionHead) return;

        const fetchPendingCount = async () => {
            // If division head (not council), only count their division
            const myDivision = Object.entries(DIVISION_HEADS).find(
                ([_, head]) => head.member_id === member.member_id
            )?.[0];

            const count = await getPendingDivisionRequestsCount(
                isCouncil ? undefined : myDivision
            );
            setPendingDivisionRequestsCount(count);
        };
        fetchPendingCount();
        // Refresh count every 30 seconds
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, [member.member_id, member.clearance]);

    // Fetch data from Supabase on mount
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Check if super admin and fetch tasks accordingly
                const superAdmin = isSuperAdmin(member.member_id);
                const isAlumni = member.role === 'Alumni' || member.year === 0;

                // Fetch tasks based on member role
                // - Super Admin: sees all tasks
                // - Alumni: no tasks
                // - Regular members: their own tasks
                let fetchedTasks: any[] = [];
                if (!isAlumni) {
                    if (superAdmin) {
                        // Super admin sees ALL tasks
                        fetchedTasks = await getTasksForMemberByRole(
                            member.member_id,
                            member.year,
                            member.clearance,
                            member.role
                        );
                    } else {
                        fetchedTasks = await getAllTasksForMember(member.member_id);
                    }
                }

                if (fetchedTasks && fetchedTasks.length > 0) {
                    // Convert Supabase task format to local format
                    const convertedTasks: Task[] = fetchedTasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        dueDate: t.due_date,
                        assignedBy: t.assigned_by === 'Self' ? 'Self' : t.assigned_by_name,
                        category: t.category,
                        description: t.description
                    }));
                    setTasks(convertedTasks);
                } else {
                    // No tasks in DB - start with empty
                    setTasks([]);
                }

                // Fetch announcements based on member role
                // - Super Admin: all announcements
                // - Alumni: only UDAAN-000 announcements
                // - Regular members: all announcements
                const fetchedAnnouncements = await getAnnouncementsForMember(member.member_id, member.role);

                if (fetchedAnnouncements && fetchedAnnouncements.length > 0) {
                    const convertedAnnouncements: Announcement[] = fetchedAnnouncements.map(a => ({
                        id: a.id,
                        title: a.title,
                        content: a.content,
                        date: a.date,
                        type: a.type,
                        createdBy: a.created_by_name
                    }));
                    setAnnouncements(convertedAnnouncements);
                } else {
                    // No announcements in DB
                    setAnnouncements([]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                // On error, use empty data
                setTasks([]);
                setAnnouncements([]);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [member.member_id, member.role, member.year, member.clearance]);

    const handleAddAnnouncement = async (announcement: Announcement) => {
        // Add to Supabase
        const created = await createAnnouncement({
            title: announcement.title,
            content: announcement.content,
            type: announcement.type,
            date: announcement.date,
            created_by: member.member_id,
            created_by_name: formatName(member.name)
        });

        if (created) {
            // Update local state with the created announcement
            setAnnouncements(prev => [{
                ...announcement,
                id: created.id
            }, ...prev]);

            // Send notification to all members about the new announcement
            // Alumni only receive notifications for announcements from UDAAN-000
            const allMembers = await getMembers();
            const superAdmin = isSuperAdmin(member.member_id);

            // Filter recipients based on who is posting
            const recipients = allMembers.filter(m => {
                // Skip the member who created the announcement
                if (m.member_id === member.member_id) return false;

                // Alumni only receive notifications from UDAAN-000 (admin) announcements
                if (m.role === 'Alumni' || m.year === 0) {
                    return superAdmin; // Only include alumni if poster is super admin
                }

                return true; // All other members receive notifications
            });

            if (recipients.length > 0) {
                // Format the event date nicely
                const eventDate = new Date(announcement.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                // Format announcement date
                const announcedDate = new Date().toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                // Get announcement type label
                const typeLabels: { [key: string]: string } = {
                    'meeting': '📅 Meeting',
                    'update': '📢 Update',
                    'deadline': '⏰ Deadline',
                    'important': '🚨 Important'
                };
                const typeLabel = typeLabels[announcement.type] || announcement.type;

                // Build detailed message
                const detailedMessage = `📌 Type: ${typeLabel}

📝 ${announcement.content}

📆 Event Date: ${eventDate}
🕐 Announced: ${announcedDate}
👤 Posted by: ${formatName(member.name)}`;

                const notifications = recipients.map(m => ({
                    member_id: m.member_id,
                    type: 'announcement' as const,
                    title: announcement.title,
                    message: detailedMessage,
                    link: '/team-login',
                    // Store metadata in DB for reference
                    announcement_id: created.id,
                    event_date: announcement.date,
                    announcement_type: announcement.type
                }));
                await createBulkNotifications(notifications);
            }

            // Log activity
            await logActivity({
                member_id: member.member_id,
                member_name: formatName(member.name),
                action: 'announcement_created',
                details: `Created announcement: "${announcement.title}"`,
                target_type: 'announcement',
                target_id: created.id
            });
        } else {
            // Still add locally for immediate feedback
            setAnnouncements(prev => [announcement, ...prev]);
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        // Delete from Supabase
        await deleteAnnouncementFromDB(id);
        // Update local state
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    };

    const handleAddTask = async (task: Task) => {
        // Add to Supabase
        const created = await createSelfTask({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            category: task.category,
            due_date: task.dueDate,
            member_id: member.member_id,
            member_name: member.name
        });

        if (created) {
            setTasks(prev => [{
                ...task,
                id: created.id
            }, ...prev]);
        } else {
            // Fallback to local state if DB fails
            setTasks(prev => [task, ...prev]);
        }
    };

    const handleDeleteTask = async (id: string) => {
        // Delete from Supabase (and related notifications)
        await deleteTask(id);
        // Update local state
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleUpdateTask = async (id: string, status: 'pending' | 'in-progress' | 'completed') => {
        // Update in Supabase
        await updateTaskStatusInDB(id, status);
        // Update local state
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            );
        }

        switch (activeTab) {
            case 'induction-approvals':
                // Double check for President access
                if (member.role.toLowerCase().includes('president') && !member.role.toLowerCase().includes('vice')) {
                    return <InductionApprovalsTab />;
                }
                return <div className="flex items-center justify-center h-64 text-white/50">Access Restricted</div>;
            case 'dashboard':
                // Show simple welcome message for provisional (induction) members
                if (member.status === 'provisional') {
                    return (
                        <div className="flex items-center justify-center min-h-[60vh]">
                            <div className="text-center">
                                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                                    Hello {member.name.split(' ')[0]}! 👋
                                </h1>
                                <p className="text-xl lg:text-2xl text-white/70">
                                    Welcome to UDAAN Induction
                                </p>
                            </div>
                        </div>
                    );
                }
                return <DashboardTab member={member} tasks={tasks} announcements={announcements} />;
            case 'task-registration':
                // Task 1: Registration for induction candidates
                return (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Task 1: Registration</h1>
                            <p className="text-white/50 text-sm mt-1">Complete your registration details</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-8 text-center">
                            <ClipboardList size={48} className="mx-auto text-blue-400 mb-4" />
                            <p className="text-white/70">Registration task content will appear here.</p>
                        </div>
                    </div>
                );
            case 'task-online-test':
                // Task 2: Online Test for induction candidates
                // TEST-REQUIRED subsystems: Drone, RC, Rocketry
                // NO-TEST subsystems: Creative/Web-Dev, Management

                // Parse member's divisions
                let memberDivisions: string[] = [];
                const memberAny = member as any;
                if (Array.isArray(memberAny.divisions)) {
                    memberDivisions = memberAny.divisions;
                } else if (typeof member.division === 'string' && member.division) {
                    memberDivisions = member.division.split(',').map((d: string) => d.trim().toLowerCase());
                }

                // Use pattern matching to detect subsystems (more robust than exact key matching)
                const detectSubsystem = (divisions: string[], patterns: string[], displayName: string): string | null => {
                    const hasMatch = divisions.some(d => {
                        const lower = d.toLowerCase();
                        return patterns.some(pattern => {
                            if (pattern.includes(' ')) {
                                return lower.includes(pattern);
                            }
                            return lower === pattern || lower.includes(pattern);
                        });
                    });
                    return hasMatch ? displayName : null;
                };

                // Detect test-required subsystems: Drone, RC Plane, Rocketry
                const detectedSubsystems: string[] = [];

                if (detectSubsystem(memberDivisions, ['drone'], 'Drone')) {
                    detectedSubsystems.push('Drone');
                }
                if (detectSubsystem(memberDivisions, ['rc plane', 'rcplane', 'rc'], 'RC Plane')) {
                    detectedSubsystems.push('RC Plane');
                }
                if (detectSubsystem(memberDivisions, ['rocketry', 'rocket'], 'Rocketry')) {
                    detectedSubsystems.push('Rocketry');
                }

                // Remove duplicates (shouldn't have any, but just in case)
                const uniqueTestDivisions = [...new Set(detectedSubsystems)];

                // Check if user has ONLY non-test subsystems (Creative/Management)
                const hasNoTestSubsystems = uniqueTestDivisions.length === 0 && memberDivisions.length > 0;

                return (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Task 2: Online Test</h1>
                            <p className="text-white/50 text-sm mt-1">Complete the online assessment for your subsystem</p>
                        </div>

                        {hasNoTestSubsystems ? (
                            // Creative and/or Management only - no test required
                            <div className="bg-gray-800/50 rounded-xl border border-green-500/30 p-8 text-center">
                                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
                                <p className="text-white text-lg font-medium mb-2">No Test Required</p>
                                <p className="text-white/50">No test required for your selected subsystem(s). Creative and Management divisions are evaluated through other criteria.</p>
                            </div>
                        ) : uniqueTestDivisions.length > 0 ? (
                            <div className="space-y-4">
                                <p className="text-white/70 text-sm">
                                    Please complete the online test for your selected subsystem(s):
                                </p>
                                <div className="grid gap-3">
                                    {uniqueTestDivisions.map(division => {
                                        // Test info for each test-required division (Drone, RC, Rocketry only)
                                        // Drone test link becomes available after Feb 9, 2026 11:59 PM IST
                                        const droneTestDeadline = new Date('2026-02-09T23:59:00+05:30');
                                        const isDroneTestAvailable = new Date() > droneTestDeadline;

                                        const testInfo: Record<string, { date: string, link: string }> = {
                                            'Drone': {
                                                date: '10th February, 2026',
                                                link: isDroneTestAvailable ? 'https://unstop.com/o/XE8ZULy?utm_medium=Share&utm_source=424phbeh40138&utm_campaign=Quizzes' : '#'
                                            },
                                            'RC Plane': {
                                                date: '11th February, 2026',
                                                link: 'https://unstop.com/o/JAsotlj?lb=0Bj3w9bx&utm_medium=Share&utm_source=mithunvk25580&utm_campaign=Quizzes'
                                            },
                                            'Rocketry': {
                                                date: '12th February, 2026',
                                                link: 'https://unstop.com/o/wdTMx86?utm_medium=Share&utm_source=dipansin19866&utm_campaign=Quizzes'
                                            }
                                        };
                                        const info = testInfo[division] || { date: 'TBA', link: '#' };

                                        return (
                                            <details key={division} className="bg-gray-800/50 rounded-xl border border-white/10 group">
                                                <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${division === 'Drone' ? 'bg-blue-500/20 text-blue-400' :
                                                            division === 'RC Plane' ? 'bg-green-500/20 text-green-400' :
                                                                'bg-orange-500/20 text-orange-400'
                                                            }`}>
                                                            <FileText size={24} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-white font-medium">{division} Test</h3>
                                                            <p className="text-white/50 text-sm">Online assessment for {division}</p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown size={20} className="text-white/50 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="px-6 pb-6 pt-2 border-t border-white/10 mt-2">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <Calendar size={18} className="text-white/40" />
                                                            <div>
                                                                <p className="text-white/40 text-xs uppercase tracking-wider">Test Date</p>
                                                                <p className="text-white font-medium">{info.date}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <ExternalLink size={18} className="text-white/40" />
                                                            <div>
                                                                <p className="text-white/40 text-xs uppercase tracking-wider">Test Link (Unstop)</p>
                                                                {info.link === '#' ? (
                                                                    <p className="text-white/50 italic">Link will be available soon</p>
                                                                ) : (
                                                                    <a
                                                                        href={info.link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`font-medium hover:underline ${division === 'Drone' ? 'text-blue-400' :
                                                                            division === 'RC Plane' ? 'text-green-400' :
                                                                                'text-orange-400'
                                                                            }`}
                                                                    >
                                                                        Open Test on Unstop →
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            // No divisions selected yet
                            <div className="bg-gray-800/50 rounded-xl border border-white/10 p-8 text-center">
                                <AlertCircle size={48} className="mx-auto text-yellow-400 mb-4" />
                                <p className="text-white text-lg font-medium mb-2">No Subsystem Selected</p>
                                <p className="text-white/50">Please ensure your subsystem preference is recorded in your application.</p>
                            </div>
                        )}
                    </div>
                );
            case 'task-assigned': {
                // Task 3: Assigned Task for induction candidates - based on their selected divisions
                // NOTE: Task 3 is currently LOCKED
                const isTask3Locked = false;
                if (isTask3Locked) {
                    return (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-bold text-white">Task 3: Assigned Task</h1>
                                <p className="text-white/50 text-sm mt-1">Complete the tasks for your selected subsystem(s)</p>
                            </div>
                            <div className="bg-gray-800/50 rounded-xl border border-yellow-500/30 p-8 text-center">
                                <Lock size={48} className="mx-auto text-yellow-400 mb-4" />
                                <p className="text-white text-lg font-medium mb-2">Task 3 is Locked</p>
                                <p className="text-white/50">This task will be available soon. Please complete Task 1 and Task 2 in the meantime.</p>
                            </div>
                        </div>
                    );
                }

                // Handle both divisions (array) and division (comma-separated string) formats
                let task3Divisions: string[] = [];
                const memberAny = member as any;
                if (Array.isArray(memberAny.divisions)) {
                    task3Divisions = memberAny.divisions;
                } else if (typeof member.division === 'string' && member.division) {
                    task3Divisions = member.division.split(',').map((d: string) => d.trim().toLowerCase());
                }

                // Subsystem detection - consistent with Task 2 parsing
                const hasDrone = task3Divisions.some((d: string) => d.toLowerCase().includes('drone'));
                const hasRCPlane = task3Divisions.some((d: string) => {
                    const lower = d.toLowerCase();
                    return lower.includes('rc plane') || lower.includes('rcplane') ||
                        lower === 'rc' || lower.startsWith('rc ') || lower.endsWith(' rc') ||
                        (lower.includes('rc') && lower.includes('plane'));
                });
                const hasRocketry = task3Divisions.some((d: string) => {
                    const lower = d.toLowerCase();
                    return lower.includes('rocketry') || lower.includes('rocket');
                });
                const hasCreative = task3Divisions.some((d: string) =>
                    d.toLowerCase().includes('creative') ||
                    d.toLowerCase().includes('web') ||
                    d.toLowerCase().includes('design') ||
                    d.toLowerCase().includes('webdev') ||
                    d.toLowerCase().includes('web-dev')
                );
                // Management-only check (no task required)
                const hasManagement = task3Divisions.some((d: string) => d.toLowerCase().includes('management'));
                const hasOnlyManagement = hasManagement && !hasDrone && !hasRCPlane && !hasRocketry && !hasCreative;

                return (
                    <div className="space-y-6">
                        {/* ... existing rendering logic (kept but unreachable for now) ... */}
                        {/* I will keep the code here but commented out or unreachable effectively to preserve it for when they want to unlock */}
                        {/* Actually, replacing the whole block is cleaner. I will overwrite it and when they ask to unlock, I can revert/uncomment. */}
                        {/* Wait, the user said "I'll tell you when to open it", implying temporary. I should keep the code structure but just return early. */}

                        <div>
                            <h1 className="text-2xl font-bold text-white">Task 3: Assigned Task</h1>
                            <p className="text-white/50 text-sm mt-1">Complete the tasks for your selected subsystem(s)</p>
                        </div>

                        {/* Drone Task */}
                        {hasDrone && (
                            <div className="bg-gray-800/50 rounded-xl border border-blue-500/30 p-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                        <Plane size={20} className="text-blue-400" />
                                    </div>
                                    <h2 className="text-white font-bold text-lg">Drone Division Task</h2>
                                </div>
                                <a
                                    href="/tasks/Drone_Task.docx"
                                    download
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <ExternalLink size={16} />
                                    Download Task
                                </a>
                            </div>
                        )}

                        {/* RC Plane Task */}
                        {hasRCPlane && (
                            <div className="bg-gray-800/50 rounded-xl border border-green-500/30 p-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                        <Plane size={20} className="text-green-400" />
                                    </div>
                                    <h2 className="text-white font-bold text-lg">RC Plane Division Task</h2>
                                </div>
                                <a
                                    href="/tasks/RC_Task.pdf"
                                    download
                                    className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <ExternalLink size={16} />
                                    Download Task
                                </a>
                            </div>
                        )}

                        {/* Rocketry Task */}
                        {hasRocketry && (
                            <div className="bg-gray-800/50 rounded-xl border border-orange-500/30 p-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                        <Rocket size={20} className="text-orange-400" />
                                    </div>
                                    <h2 className="text-white font-bold text-lg">Rocketry Division Task</h2>
                                </div>
                                <a
                                    href="/tasks/Rocket_task.docx"
                                    download
                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <ExternalLink size={16} />
                                    Download Task
                                </a>
                            </div>
                        )}

                        {/* Creative/Web-Dev Tasks */}
                        {hasCreative && (
                            <div className="space-y-4">
                                <div className="bg-gray-800/50 rounded-xl border border-purple-500/30 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                                            <Palette size={20} className="text-purple-400" />
                                        </div>
                                        <h2 className="text-white font-bold text-lg">Creative Division Tasks</h2>
                                    </div>

                                    {/* Task 1 */}
                                    <div className="mb-6 pb-6 border-b border-white/10">
                                        <h3 className="text-purple-400 font-bold mb-2">1. Design a Poster for Induction of the Club</h3>
                                        <p className="text-white/70 text-sm mb-3">Create an engaging poster to promote Udaan's induction drive.</p>
                                        <div className="text-white/50 text-sm">
                                            <span className="text-white/70 font-medium">References:</span>
                                            <ul className="mt-1 space-y-1 ml-4 list-disc">
                                                <li><a href="https://www.instagram.com/p/DUOroEuk0zQ/?img_index=1" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Instagram Reference 1</a></li>
                                                <li><a href="https://www.instagram.com/p/DOJDuvrDN04/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Instagram Reference 2</a></li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Task 2 */}
                                    <div className="mb-6 pb-6 border-b border-white/10">
                                        <h3 className="text-pink-400 font-bold mb-2">2. Design an AIRSHOW Poster</h3>
                                        <p className="text-white/70 text-sm mb-3">Create a captivating poster for Udaan's flagship event - AIRSHOW.</p>
                                        <div className="text-white/50 text-sm">
                                            <span className="text-white/70 font-medium">Reference:</span>
                                            <ul className="mt-1 space-y-1 ml-4 list-disc">
                                                <li><a href="https://www.instagram.com/p/DT7x74zkznb/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Instagram Reference</a></li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Guidelines */}
                                    <div className="bg-black/30 rounded-lg p-4">
                                        <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                            <AlertCircle size={16} className="text-yellow-400" />
                                            Guidelines
                                        </h4>
                                        <ul className="text-white/70 text-sm space-y-2">
                                            <li className="flex items-start gap-2">
                                                <span className="text-purple-400">i)</span>
                                                <span>Poster size should be <strong className="text-white">1080 x 1350 px</strong> (Instagram new size)</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-purple-400">ii)</span>
                                                <span>It should match Udaan's technical & creative aspect</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-purple-400">iii)</span>
                                                <span>Use Udaan's Instagram for reference: <a href="https://www.instagram.com/udaan_nitr/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">@udaan_nitr</a></span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-purple-400">iv)</span>
                                                <span>Use <strong className="text-white">only official logos</strong> provided below in your poster designs</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Logo Downloads */}
                                <div className="bg-gray-800/50 rounded-xl border border-white/10 p-6">
                                    <h3 className="text-white font-bold text-lg mb-4">Download Logos</h3>
                                    <p className="text-white/50 text-sm mb-4">Use these official logos for your creative submissions:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-black/30 rounded-lg p-4 flex flex-col items-center">
                                            <img src="/logos/udaan-logo.svg" alt="Udaan Logo" className="w-24 h-24 object-contain mb-3" />
                                            <span className="text-white/70 text-sm mb-2">Udaan Logo</span>
                                            <a
                                                href="/logos/udaan-logo.svg"
                                                download="udaan-logo.svg"
                                                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-xs font-medium transition-colors"
                                            >
                                                Download SVG
                                            </a>
                                        </div>
                                        <div className="bg-black/30 rounded-lg p-4 flex flex-col items-center">
                                            <img src="/logos/nit-rourkela-logo.svg" alt="NIT Rourkela Logo" className="w-24 h-24 object-contain mb-3" />
                                            <span className="text-white/70 text-sm mb-2">NIT Rourkela Logo</span>
                                            <a
                                                href="/logos/nit-rourkela-logo.svg"
                                                download="nit-rourkela-logo.svg"
                                                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded text-xs font-medium transition-colors"
                                            >
                                                Download SVG
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submission Instructions */}
                        {(hasDrone || hasRCPlane || hasRocketry || hasCreative) && (
                            <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-6 mt-6">
                                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                    <Send size={20} className="text-blue-400" />
                                    Submission Instructions
                                </h3>
                                <ul className="space-y-3 text-sm text-white/70">
                                    <li className="flex items-start gap-2">
                                        <Mail size={16} className="text-blue-400 mt-1 shrink-0" />
                                        <span>
                                            Submit your task via email to: <a href="mailto:nitrudaan07@gmail.com" className="text-blue-400 hover:underline">nitrudaan07@gmail.com</a>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <FileText size={16} className="text-blue-400 mt-1 shrink-0" />
                                        <span>
                                            File Format: <strong>.zip</strong>
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Edit3 size={16} className="text-blue-400 mt-1 shrink-0" />
                                        <span>
                                            Naming Convention: <strong>&lt;Candidate Name&gt;_&lt;Subsystem Name&gt;_Task</strong>
                                            <br />
                                            <span className="text-xs opacity-60">(e.g., NiravSayanja_Drone_Task.zip)</span>
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {/* Management-only: No task required */}
                        {hasOnlyManagement && (
                            <div className="bg-gray-800/50 rounded-xl border border-green-500/30 p-8 text-center">
                                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
                                <p className="text-white text-lg font-medium mb-2">No Task Required</p>
                                <p className="text-white/50">Management division members are evaluated through interviews and other criteria. No technical task submission is required.</p>
                            </div>
                        )}

                        {/* No divisions selected at all */}
                        {!hasDrone && !hasRCPlane && !hasRocketry && !hasCreative && !hasManagement && (
                            <div className="bg-gray-800/50 rounded-xl border border-white/10 p-8 text-center">
                                <AlertCircle size={48} className="mx-auto text-yellow-400 mb-4" />
                                <p className="text-white text-lg font-medium mb-2">No Subsystem Selected</p>
                                <p className="text-white/50">Please ensure your subsystem preference is recorded in your application.</p>
                            </div>
                        )}
                    </div>
                );
            }
            case 'whatsapp-group':
                // WhatsApp Group for induction candidates
                return (
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white">WhatsApp Group</h1>
                            <p className="text-white/50 text-sm mt-1">Join the Udaan Freshers Induction 2026 group</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl border border-white/10 p-8">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-64 h-64 bg-white rounded-xl p-2 mb-6">
                                    <img
                                        src="/whatsapp-qr.png"
                                        alt="WhatsApp Group QR Code"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <h3 className="text-white font-medium text-lg mb-2">Udaan Freshers Induction 2026</h3>
                                <p className="text-white/50 text-sm mb-6">Scan the QR code or click the button below to join</p>
                                <a
                                    href="https://chat.whatsapp.com/FH5k4EoUpxlLh3w8L5JkSE?mode=gi_t"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-medium rounded-lg transition-colors"
                                >
                                    <Smartphone size={20} />
                                    Join WhatsApp Group
                                </a>
                            </div>
                        </div>
                    </div>
                );
            case 'tasks':
                return <TasksTab
                    tasks={tasks}
                    title="My Tasks"
                    currentMember={member}
                    onAddTask={handleAddTask}
                    onDeleteTask={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                />;
            case 'notifications':
                return <NotificationsTab
                    memberId={member.member_id}
                    onMarkAsRead={() => setUnreadNotificationCount(prev => Math.max(0, prev - 1))}
                    onMarkAllAsRead={() => setUnreadNotificationCount(0)}
                />;
            case 'assigned':
                return <TasksTab
                    tasks={tasks.filter(t => t.assignedBy !== 'Self')}
                    title="Assigned to Me"
                    currentMember={member}
                    onAddTask={handleAddTask}
                    onDeleteTask={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                />;
            case 'assign-task':
                return <AssignTaskTab currentMember={member} />;
            case 'add-member':
                return <AddMemberTab currentMember={member} />;
            case 'announcements':
                return <AnnouncementsTab
                    announcements={announcements}
                    onAddAnnouncement={handleAddAnnouncement}
                    onDeleteAnnouncement={handleDeleteAnnouncement}
                />;
            case 'council-transfer':
                return <CouncilTransferTab currentMember={member} />;
            case 'admin-report':
                return <AdminReportTab currentMember={member} />;
            case 'join-corps-applications':
                return <JoinCorpsApplicationsTab currentMember={member} />;
            case 'id-card':
                return <IDCardTab member={member} />;
            case 'team':
                return <TeamTab currentMember={member} />;
            case 'division-requests':
                return <DivisionRequestsTab currentMember={member} />;
            case 'settings':
                return <SettingsTab currentMember={member} onLogout={onLogout} />;
            default:
                return <DashboardTab member={member} tasks={tasks} announcements={announcements} />;
        }
    };

    return (
        <div className="min-h-screen bg-nation-void">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar member={member} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} unreadCount={unreadNotificationCount} pendingRequestsCount={pendingDivisionRequestsCount} />
            </div>

            {/* Mobile Header */}
            <MobileHeader member={member} onLogout={onLogout} />

            {/* Main Content - Mobile: Reduced padding for higher density */}
            <div className="lg:ml-64">
                <div className="p-3 sm:p-4 lg:p-8 pt-16 lg:pt-8 pb-20 lg:pb-8">
                    {/* President quick action: Email induction candidates */}
                    {(member.member_id === 'UDAAN-001' || (member.role.toLowerCase().includes('president') && !member.role.toLowerCase().includes('vice'))) && activeTab === 'join-corps-applications' && (
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={openEmailModal}
                                className="px-3 py-2 bg-nation-secondary text-black font-display font-semibold text-xs rounded-md hover:bg-white transition-colors"
                            >
                                Email Induction Candidates
                            </button>
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderContent()}
                            {/* Bulk Email Modal for President */}
                            <AnimatePresence>
                                {showEmailModal && (
                                    <motion.div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEmailModal(false)}>
                                        <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 10 }} className="max-w-3xl w-full bg-nation-panel border border-white/10 rounded-lg p-6 my-auto" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-white font-display text-lg">Email Induction Candidates</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/50 text-sm">{bulkProgress.done}/{bulkProgress.total}</span>
                                                    <button onClick={() => setShowEmailModal(false)} className="text-white/40 hover:text-white">Close</button>
                                                </div>
                                            </div>

                                            <div
                                                className="mb-4 max-h-[60vh] overflow-y-auto scrollbar-thin border border-white/5 rounded p-2 bg-black/20"
                                                style={{
                                                    overflowY: 'auto',
                                                    WebkitOverflowScrolling: 'touch',
                                                    touchAction: 'pan-y',
                                                    scrollBehavior: 'smooth'
                                                }}
                                                onWheel={(e) => {
                                                    e.stopPropagation();
                                                    const target = e.currentTarget;
                                                    target.scrollTop += e.deltaY;
                                                }}
                                            >
                                                {applicantsList.length === 0 && (<div className="text-white/50 text-sm p-4">No applicants found.</div>)}

                                                {/* Select all control - sticky at top */}
                                                {applicantsList.length > 0 && (
                                                    <div className="flex items-center justify-between p-2 mb-2 sticky top-0 bg-nation-panel z-10 border-b border-white/10">
                                                        <label className="flex items-center gap-2 text-sm text-white/70">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedApplicantIds.length === applicantsList.length}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedApplicantIds(applicantsList.map(a => a.id).filter(Boolean));
                                                                    else setSelectedApplicantIds([]);
                                                                }}
                                                                className="w-4 h-4"
                                                            />
                                                            Select all
                                                        </label>
                                                        <div className="text-white/50 text-xs">{selectedApplicantIds.length}/{applicantsList.length} selected</div>
                                                    </div>
                                                )}

                                                {applicantsList.map((a, idx) => (
                                                    <div key={a.id || idx} className="flex items-center justify-between gap-4 p-2 odd:bg-white/2/5">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedApplicantIds.includes(a.id)}
                                                                disabled={!a.email_verified}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedApplicantIds(prev => Array.from(new Set([...prev, a.id])));
                                                                    else setSelectedApplicantIds(prev => prev.filter(id => id !== a.id));
                                                                }}
                                                                className="w-4 h-4 flex-shrink-0"
                                                            />
                                                            <div>
                                                                <div className="text-white font-medium truncate">{a.name}</div>
                                                                <div className="text-white/50 text-sm truncate">{a.email}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-sm text-white/60">
                                                            {a.year || ''}
                                                            {!a.email_verified && <span className="ml-2 text-xs text-yellow-300">(email not verified)</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => { setShowEmailModal(false); }}
                                                    className="px-3 py-2 rounded border border-white/10 text-nation-text hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={promoteAndEmailAll}
                                                    disabled={isBulkProcessing || selectedApplicantIds.length === 0}
                                                    className="px-4 py-2 bg-nation-secondary text-black font-bold rounded disabled:opacity-50"
                                                >
                                                    {isBulkProcessing ? `Processing ${bulkProgress.done}/${bulkProgress.total}` : 'Promote & Email Selected'}
                                                </button>
                                            </div>

                                            {bulkResults.length > 0 && (
                                                <div className="mt-4">
                                                    <h4 className="text-white text-sm mb-2">Results</h4>
                                                    <div className="max-h-40 overflow-y-auto border border-white/5 rounded p-2 bg-black/20">
                                                        {bulkResults.map((r, i) => (
                                                            <div key={i} className={`flex items-center justify-between text-sm p-1 ${r.success ? 'text-green-300' : 'text-red-300'}`}>
                                                                <div className="truncate">{r.email}</div>
                                                                <div className="ml-4">{r.success ? 'OK' : r.message || 'Failed'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Mobile Bottom Navigation - Full parity with desktop sidebar
                All actions available on desktop MUST be available on mobile.
                Uses scrollable horizontal nav with all menu items */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-white/5 z-50 safe-area-inset-bottom">
                {/* Scroll indicator - left fade */}
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-gray-900/95 to-transparent pointer-events-none z-10"></div>
                {/* Scroll indicator - right fade */}
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-900/95 to-transparent pointer-events-none z-10"></div>

                <div className="flex overflow-x-auto scrollbar-hide gap-1 px-6 py-2">
                    {(() => {
                        // Mobile nav parity: replicate exact same logic as desktop Sidebar
                        const isCouncil = member.clearance === 5;
                        const isPresident = member.role.toLowerCase().includes('president') && !member.role.toLowerCase().includes('vice');
                        const is4thYear = member.year === 4;
                        const superAdmin = isSuperAdmin(member.member_id);
                        const isAlumni = member.role === 'Alumni' || member.year === 0;
                        const isProvisionalMember = member.status === 'provisional';
                        const canAssignTasks = (isCouncil || is4thYear) && !isAlumni;
                        const isDivisionHead = Object.values(DIVISION_HEADS).some(h => h.member_id === member.member_id);

                        // Build mobile nav items matching desktop sidebar exactly
                        let navItems: { id: string; icon: React.ReactNode; label: string; badge: number }[] = [];

                        if (isProvisionalMember) {
                            // Provisional (induction) members - same as desktop
                            navItems = [
                                { id: 'whatsapp-group', icon: <Smartphone size={20} />, label: 'WhatsApp', badge: 0 },
                                { id: 'task-registration', icon: <ClipboardList size={20} />, label: 'Task 1', badge: 0 },
                                { id: 'task-online-test', icon: <FileText size={20} />, label: 'Task 2', badge: 0 },
                                { id: 'task-assigned', icon: <ListTodo size={20} />, label: 'Task 3', badge: 0 },
                                { id: 'settings', icon: <Settings size={20} />, label: 'Settings', badge: 0 },
                            ];
                        } else if (isAlumni && !superAdmin) {
                            // Alumni - limited access
                            navItems = [
                                { id: 'dashboard', icon: <BarChart3 size={20} />, label: 'Home', badge: 0 },
                                { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts', badge: unreadNotificationCount },
                                { id: 'id-card', icon: <User size={20} />, label: 'ID Card', badge: 0 },
                                { id: 'settings', icon: <Settings size={20} />, label: 'Settings', badge: 0 },
                            ];
                        } else if (superAdmin) {
                            // Super Admin (UDAAN-000) - full access (matches desktop sidebar exactly)
                            navItems = [
                                { id: 'dashboard', icon: <BarChart3 size={20} />, label: 'Home', badge: 0 },
                                { id: 'admin-report', icon: <FileText size={20} />, label: 'Report', badge: 0 },
                                { id: 'tasks', icon: <ListTodo size={20} />, label: 'Tasks', badge: 0 },
                                { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts', badge: unreadNotificationCount },
                                { id: 'add-member', icon: <UserPlus size={20} />, label: 'Add', badge: 0 },
                                { id: 'announcements', icon: <MessageSquare size={20} />, label: 'News', badge: 0 },
                                { id: 'council-transfer', icon: <Crown size={20} />, label: 'Council', badge: 0 },
                                { id: 'team', icon: <Users size={20} />, label: 'Team', badge: 0 },
                                { id: 'id-card', icon: <User size={20} />, label: 'ID Card', badge: 0 },
                                { id: 'settings', icon: <Settings size={20} />, label: 'Settings', badge: 0 },
                            ];
                        } else {
                            // Regular members and council - build dynamically
                            navItems = [
                                { id: 'dashboard', icon: <BarChart3 size={20} />, label: 'Home', badge: 0 },
                                { id: 'tasks', icon: <ListTodo size={20} />, label: 'Tasks', badge: 0 },
                                { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts', badge: unreadNotificationCount },
                            ];
                            // "Assigned to Me" for non-council members
                            if (!isCouncil) {
                                navItems.push({ id: 'assigned', icon: <ClipboardList size={20} />, label: 'Assigned', badge: 0 });
                            }
                            // "Assign Task" for council and 4th year
                            if (canAssignTasks) {
                                navItems.push({ id: 'assign-task', icon: <Send size={20} />, label: 'Assign', badge: 0 });
                            }
                            // Council-only items
                            if (isCouncil) {
                                navItems.push({ id: 'add-member', icon: <UserPlus size={20} />, label: 'Add', badge: 0 });
                                navItems.push({ id: 'announcements', icon: <MessageSquare size={20} />, label: 'News', badge: 0 });
                            }
                            // Division Requests for council/division heads
                            if (isCouncil || isDivisionHead) {
                                navItems.push({ id: 'division-requests', icon: <UserPlus size={20} />, label: 'Requests', badge: pendingDivisionRequestsCount });
                            }
                            // Induction Applications (council when active, or always for President)
                            if ((isCouncil && inductionActive) || isPresident) {
                                navItems.push({ id: 'join-corps-applications', icon: <FileText size={20} />, label: 'Applicants', badge: 0 });
                            }
                            // Induction Approvals (President only)
                            if (isPresident) {
                                navItems.push({ id: 'induction-approvals', icon: <UserPlus size={20} />, label: 'Approvals', badge: 0 });
                            }
                            // Common items for all
                            navItems.push({ id: 'id-card', icon: <User size={20} />, label: 'ID Card', badge: 0 });
                            navItems.push({ id: 'team', icon: <Users size={20} />, label: 'Team', badge: 0 });
                            navItems.push({ id: 'settings', icon: <Settings size={20} />, label: 'Settings', badge: 0 });
                        }

                        return navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-all min-w-[56px] min-h-[52px] flex-shrink-0 relative ${activeTab === item.id ? 'text-blue-400 bg-blue-500/20' : 'text-white/50 active:bg-white/10'
                                    }`}
                            >
                                <div className="relative">
                                    {item.icon}
                                    {item.badge > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[9px] whitespace-nowrap font-medium">{item.label}</span>
                            </button>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

// Login Page Component
const TeamLoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [memberId, setMemberId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loggedInMember, setLoggedInMember] = useState<Member | null>(null);

    // SESSION FLASH FIX: Track session checking state to prevent login page flash
    // This ensures we don't show login form while checking for existing session
    const [isCheckingSession, setIsCheckingSession] = useState(true);

    // Check for saved session and refresh member data from DB
    // SESSION FLASH FIX: Complete session check before rendering login form
    useEffect(() => {
        const refreshMemberData = async () => {
            const savedMemberData = sessionStorage.getItem('udaanMemberData');
            const savedMemberId = sessionStorage.getItem('udaanMemberId');

            if (savedMemberData && savedMemberId) {
                try {
                    // Immediately set cached member to prevent flash
                    const cachedMember = JSON.parse(savedMemberData) as SupabaseMember;
                    setLoggedInMember({ ...cachedMember, icon: getRoleIcon(cachedMember.role) });

                    // Then refresh from database in background for latest data
                    // SECURITY: Only fetch non-sensitive fields (no password, verification codes)
                    const { data: freshMember } = await supabase
                        .from('members')
                        .select('member_id, name, email, personal_email, institute_email, roll_no, phone, department, year, division, role, clearance, status, profile_pic, is_inactive, inactive_since, email_verified, photo_uploaded_at, created_at')
                        .eq('member_id', savedMemberId)
                        .single();

                    if (freshMember) {
                        // Merge fresh data with cached data (preserves id/password from cache for type safety)
                        const mergedMember = { ...cachedMember, ...freshMember } as SupabaseMember;
                        // Update session storage with fresh data
                        sessionStorage.setItem('udaanMemberData', JSON.stringify(mergedMember));
                        setLoggedInMember({ ...mergedMember, icon: getRoleIcon(mergedMember.role) });
                    }
                    // If fetch fails, cached member is already set above
                } catch (e) {
                    sessionStorage.removeItem('udaanMemberData');
                    sessionStorage.removeItem('udaanMemberId');
                }
            }

            // SESSION FLASH FIX: Mark session check as complete
            setIsCheckingSession(false);
        };

        refreshMemberData();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Try to authenticate via Supabase
        const dbMember = await loginMember(memberId, password);

        if (dbMember) {
            const member: Member = { ...dbMember, icon: getRoleIcon(dbMember.role) };
            sessionStorage.setItem('udaanMemberId', member.member_id);
            sessionStorage.setItem('udaanMemberData', JSON.stringify(dbMember));
            setLoggedInMember(member);
        } else {
            setError('Invalid credentials.');
            try {
                const rejectAudio = (window as any).__appClickRefs?.reject;
                if (rejectAudio) { rejectAudio.currentTime = 0; rejectAudio.play().catch(() => { }); }
            } catch { }
        }
        setIsLoading(false);
    };

    const handleLogout = () => {
        const isProvisional = loggedInMember?.status === 'provisional' || sessionStorage.getItem('udaanIsProvisional') === 'true';

        sessionStorage.removeItem('udaanMemberId');
        sessionStorage.removeItem('udaanMemberData');
        sessionStorage.removeItem('udaanIsProvisional');
        setLoggedInMember(null);
        setMemberId('');
        setPassword('');

        if (isProvisional) {
            navigate('/induction-login');
        }
    };

    // Show dashboard if logged in
    if (loggedInMember) {
        return <MemberDashboard member={loggedInMember} onLogout={handleLogout} />;
    }

    // SESSION FLASH FIX: Show loading state while checking session
    // This prevents the login form from flashing before session is validated
    if (isCheckingSession) {
        return (
            <div className="min-h-screen bg-nation-void flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-white/50 text-sm">Loading session...</p>
                </div>
            </div>
        );
    }

    // Login Form
    return (
        <div className="min-h-screen bg-nation-void relative overflow-hidden">
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
            </div>

            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate('/')}
                className="fixed top-6 left-6 z-50 flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
            >
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 bg-black/40 backdrop-blur-sm">
                    <ArrowLeft size={18} />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider hidden sm:block">Back</span>
            </motion.button>

            <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-blue-500/30 flex items-center justify-center bg-blue-500/10"
                        >
                            <Fingerprint size={36} className="text-blue-400" />
                        </motion.div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wider mb-2">Member Portal</h1>
                        <p className="text-white/50 text-sm font-mono">Access your Udaan Dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">Member ID / Name</label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type="text"
                                    value={memberId}
                                    onChange={(e) => setMemberId(e.target.value)}
                                    placeholder="UDAAN-001 or Your Name"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-12 py-4 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-white/60 text-xs font-mono uppercase tracking-wider mb-2">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-12 py-4 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                                <AlertCircle size={16} />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 rounded-lg uppercase tracking-wider text-sm hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Authenticating...</>
                            ) : (
                                <><Shield size={18} />Access Dashboard</>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-white/30 text-xs mt-6 font-mono">Contact the Secretary for login credentials</p>
                </motion.div>
            </div>
        </div>
    );
};

export default TeamLoginPage;
