/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback, createContext, useContext, memo, useMemo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useInView, useSpring } from 'framer-motion';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { HeroScene, HangarScene, CombatJetScene } from './components/QuantumScene';
import { QuadRotorStatus, SubsystemPipeline, PropulsionMetrics, RocketTrajectory, AeroFlow } from './components/Diagrams';
import JoinCorpsPage from './pages/JoinCorps';
import RegisterPage from './pages/Register';
import TeamLogin from './pages/TeamLogin';
import InductionLoginPage from './pages/InductionLogin';
import { ArrowDown, Menu, X, Target, Rocket, Plane, Instagram, Linkedin, Phone, Palette, Briefcase, Calendar, MapPin, Trophy, Hexagon, Crown, Star, Scroll, Globe, Battery, Signal, Zap, Wind, Gauge, Activity, ArrowRight, Music, Music2, User, Eye, Users as UsersIcon, Clock, CheckCircle, Shield, Lock } from 'lucide-react';
import Lenis from 'lenis';
import { getAllRegistrationCounts, getCouncilMembers, type Member } from './utils/supabase';
import './types'; // Import global types
import TeamLoginPage from './pages/TeamLogin';

// --- AUDIO SYSTEM ---
interface AudioContextType {
    musicPlaying: boolean;
    toggleMusic: () => void;
}

const AudioContext = createContext<AudioContextType>({
    musicPlaying: false, toggleMusic: () => { }
});

const AudioProvider = ({ children }: { children?: React.ReactNode }) => {
    const [musicPlaying, setMusicPlaying] = useState(false);
    const bgMusicRef = useRef<HTMLAudioElement | null>(null);
    const clickAudioRef = useRef<HTMLAudioElement | null>(null);
    const rejectAudioRef = useRef<HTMLAudioElement | null>(null);
    const hasInteractedRef = useRef(false);

    // Initialize audio elements
    useEffect(() => {
        // Background music
        const bg = new Audio('/hayden-folker-surrounded.mp3');
        bg.loop = true;
        bg.volume = 0.20; // 20% of original volume
        bg.preload = 'auto';
        bgMusicRef.current = bg;

        // Expose bgMusicRef globally so toggle can always access it
        (window as any).__bgMusicRef = bg;

        // Mobile audio policy: Don't autoplay on mobile devices
        // Wait for user interaction instead
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (!isMobileDevice) {
            // Try to autoplay on desktop. If blocked by browser, wait for first user interaction.
            bg.play()
                .then(() => {
                    setMusicPlaying(true);
                })
                .catch(() => {
                    setMusicPlaying(false);
                });
        }

        // Handler to start music on first user interaction (mobile-friendly)
        const startMusicOnInteraction = () => {
            if (!hasInteractedRef.current && bgMusicRef.current) {
                hasInteractedRef.current = true;
                // Don't auto-start on mobile - let user control via toggle
                // On desktop, try to play if not already playing
                if (!isMobileDevice && bgMusicRef.current.paused) {
                    bgMusicRef.current.play()
                        .then(() => setMusicPlaying(true))
                        .catch(() => { });
                }
            }
        };

        // Listen for first interaction (useful for browsers that block autoplay)
        document.addEventListener('click', startMusicOnInteraction, { once: true });
        document.addEventListener('touchstart', startMusicOnInteraction, { once: true });
        document.addEventListener('keydown', startMusicOnInteraction, { once: true });

        // Click and reject sounds (lower volume so bg music is audible)
        const clickAudio = new Audio('/Click.mp3');
        clickAudio.volume = 0.08;
        clickAudioRef.current = clickAudio;

        const rejectAudio = new Audio('/Reject.wav');
        rejectAudio.volume = 0.12;
        rejectAudioRef.current = rejectAudio;

        // Expose refs globally for imperative handlers elsewhere
        try {
            (window as any).__appClickRefs = {
                click: clickAudioRef.current,
                reject: rejectAudioRef.current,
            };
            (window as any).__appBgMusic = bgMusicRef.current;
            (globalThis as any).rejectAudioRef = rejectAudioRef.current;
        } catch (err) { }

        // Global click handler plays click sound only for buttons and cards
        // Also works with touch events on mobile
        const onDocClick = (e: MouseEvent | TouchEvent) => {
            try {
                // allow temporary suppression flag
                if ((window as any).__suppressClickAudio) return;

                // Only play for interactive elements (buttons, cards, links, inputs)
                const target = (e as TouchEvent).touches
                    ? (e as TouchEvent).touches[0]?.target as HTMLElement
                    : (e as MouseEvent).target as HTMLElement;
                if (!target) return;

                const isInteractive = target.closest('button, a, [role="button"], .hover-glow, .magnetic, input, textarea, [data-cursor-hover], .group');
                if (!isInteractive) return;

                const a = clickAudioRef.current;
                if (a) {
                    a.currentTime = 0;
                    a.play().catch(() => { });
                }
            } catch (err) { }
        };

        document.addEventListener('click', onDocClick);
        document.addEventListener('touchend', onDocClick);

        return () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('touchend', onDocClick);
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
            document.removeEventListener('keydown', startMusicOnInteraction);
            if (bgMusicRef.current) {
                bgMusicRef.current.pause();
                bgMusicRef.current = null;
            }
            try { delete (window as any).__appClickRefs; } catch { }
            try { delete (window as any).__appBgMusic; } catch { }
            try { delete (window as any).__bgMusicRef; } catch { }
            try { delete (globalThis as any).rejectAudioRef; } catch { }
            clickAudioRef.current = null;
            rejectAudioRef.current = null;
        };
    }, []);

    const toggleMusic = useCallback(() => {
        // Try both the ref and the global reference
        const audio = bgMusicRef.current || (window as any).__bgMusicRef;
        if (!audio) {
            return;
        }

        if (audio.paused) {
            audio.play()
                .then(() => {
                    setMusicPlaying(true);
                })
                .catch(() => {
                    // Audio play failed - suppress in production
                });
        } else {
            audio.pause();
            setMusicPlaying(false);
        }
    }, []);

    return (
        <AudioContext.Provider value={{ musicPlaying, toggleMusic }}>
            {children}
        </AudioContext.Provider>
    );
};

const useAudio = () => useContext(AudioContext);

// --- CUSTOM CURSOR COMPONENT (disabled on touch devices) ---
const CustomCursor: React.FC = memo(() => {
    const cursorRef = useRef<HTMLDivElement>(null);
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isClicking, setIsClicking] = useState(false);
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
        // Detect touch device and disable custom cursor
        const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        setIsTouch(touchDevice);

        // Don't set up cursor events on touch devices
        if (touchDevice) return;

        const cursor = cursorRef.current;
        const cursorDot = cursorDotRef.current;
        if (!cursor || !cursorDot) return;

        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;
        let animationId: number;

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            // Dot follows immediately
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        };

        const handleMouseDown = () => setIsClicking(true);
        const handleMouseUp = () => setIsClicking(false);

        // Smooth animation for outer ring
        const animate = () => {
            const dx = mouseX - cursorX;
            const dy = mouseY - cursorY;

            cursorX += dx * 0.15;
            cursorY += dy * 0.15;

            cursor.style.left = `${cursorX}px`;
            cursor.style.top = `${cursorY}px`;

            animationId = requestAnimationFrame(animate);
        };

        // Detect hoverable elements
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, [role="button"], .hover-glow, .magnetic, input, textarea, [data-cursor-hover]')) {
                setIsHovering(true);
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, [role="button"], .hover-glow, .magnetic, input, textarea, [data-cursor-hover]')) {
                setIsHovering(false);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);

        animationId = requestAnimationFrame(animate);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mouseout', handleMouseOut);
            cancelAnimationFrame(animationId);
        };
    }, []);

    // Don't render custom cursor on touch devices
    if (isTouch) return null;

    return (
        <>
            {/* Outer ring - follows with delay */}
            <div
                ref={cursorRef}
                className={`fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-200 ${isHovering
                    ? 'w-12 h-12 border-nation-secondary bg-nation-secondary/10'
                    : isClicking
                        ? 'w-6 h-6 border-nation-accent bg-nation-accent/20'
                        : 'w-8 h-8 border-white/50'
                    }`}
                style={{ mixBlendMode: 'difference' }}
            />
            {/* Inner dot - follows immediately */}
            <div
                ref={cursorDotRef}
                className={`fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100 ${isHovering
                    ? 'w-1 h-1 bg-nation-secondary'
                    : 'w-2 h-2 bg-white'
                    }`}
            />
        </>
    );
});

// --- SPOTLIGHT EFFECT COMPONENT ---
const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string }> = memo(({ children, className = '' }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        const rect = divRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleMouseEnter = () => setOpacity(1);
    const handleMouseLeave = () => setOpacity(0);

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden ${className}`}
        >
            {/* Spotlight gradient */}
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
                }}
            />
            {children}
        </div>
    );
});

// --- UTILITY COMPONENTS ---

// Magnetic effect component - disabled on touch devices for better mobile UX
const Magnetic: React.FC<{ children?: React.ReactNode }> = memo(({ children }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isTouch, setIsTouch] = useState(false);

    useEffect(() => {
        // Detect touch device and disable magnetic effect
        const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        setIsTouch(touchDevice);
    }, []);

    const handleMouse = (e: React.MouseEvent) => {
        // Skip magnetic effect on touch devices
        if (isTouch || !ref.current) return;

        const { clientX, clientY } = e;
        const { height, width, left, top } = ref.current.getBoundingClientRect();
        const x = clientX - (left + width / 2);
        const y = clientY - (top + height / 2);
        setPosition({ x: x * 0.1, y: y * 0.1 });
    }

    const reset = () => setPosition({ x: 0, y: 0 });

    // On touch devices, render children without magnetic wrapper animation
    if (isTouch) {
        return <div className="magnetic">{children}</div>;
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouse}
            onMouseLeave={reset}
            animate={{ x: position.x, y: position.y }}
            transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
            className="magnetic"
        >
            {children}
        </motion.div>
    );
});

const GlitchText = ({ text, className = "", trigger = "view" }: { text: string, className?: string, trigger?: "hover" | "always" | "view" }) => {
    const [display, setDisplay] = useState(text);
    const [hasPlayed, setHasPlayed] = useState(false);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, amount: 0.5 });

    const glitch = useCallback(() => {
        let iteration = 0;
        const interval = setInterval(() => {
            setDisplay(text.split("").map((c, i) => {
                if (i < iteration) return text[i];
                return chars[Math.floor(Math.random() * chars.length)];
            }).join(""));
            if (iteration >= text.length) clearInterval(interval);
            iteration += 1 / 2;
        }, 15);
    }, [text, chars]);

    useEffect(() => {
        if (trigger === "view" && isInView && !hasPlayed) {
            glitch();
            setHasPlayed(true);
        }
    }, [trigger, isInView, glitch, hasPlayed]);

    return (
        <span
            ref={ref}
            className={className}
            onMouseEnter={() => { if (trigger === "hover") { glitch(); } }}
            onMouseOver={() => { if (trigger === "hover") { glitch(); } }}
        >
            {display}
        </span>
    );
};

const BOOT_SEQUENCE = [
    "> INITIALIZING AVIONICS SYSTEMS...",
    "> LOADING PROPULSION MODULE... OK",
    "> AERODYNAMICS CHECK... OK",
    "> TELEMETRY ONLINE... OK",
    "> ALL SYSTEMS NOMINAL",
    "> READY FOR LAUNCH"
];

const TypewriterIntro = ({ onStartScroll }: { onStartScroll: () => void }) => {
    const [bootPhase, setBootPhase] = useState(0); // 0: boot messages, 1: typing UDAAN, 2: complete
    const [bootMessages, setBootMessages] = useState<string[]>([]);
    const [text, setText] = useState("");
    const fullText = "UDAAN";
    const [index, setIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    // Boot messages phase
    useEffect(() => {
        if (bootPhase !== 0) return;

        let msgIndex = 0;
        const interval = setInterval(() => {
            if (msgIndex < BOOT_SEQUENCE.length) {
                setBootMessages(prev => [...prev, BOOT_SEQUENCE[msgIndex]]);
                msgIndex++;
            } else {
                clearInterval(interval);
                setTimeout(() => setBootPhase(1), 500);
            }
        }, 200);
        return () => clearInterval(interval);
    }, [bootPhase]);

    // Typing UDAAN phase
    useEffect(() => {
        if (bootPhase !== 1) return;

        if (index < fullText.length) {
            const timeout = setTimeout(() => {
                setText(prev => prev + fullText[index]);
                setIndex(prev => prev + 1);
            }, 100 + Math.random() * 150);
            return () => clearTimeout(timeout);
        } else {
            setBootPhase(2);
            setIsComplete(true);
        }
    }, [bootPhase, index]);

    useEffect(() => {
        if (isComplete) {
            const handleScroll = () => {
                onStartScroll();
            };
            window.addEventListener('wheel', handleScroll, { once: true });
            window.addEventListener('touchmove', handleScroll, { once: true });
            window.addEventListener('click', handleScroll, { once: true });
            window.addEventListener('keydown', handleScroll, { once: true });
            return () => {
                window.removeEventListener('wheel', handleScroll);
                window.removeEventListener('touchmove', handleScroll);
                window.removeEventListener('click', handleScroll);
                window.removeEventListener('keydown', handleScroll);
            }
        }
    }, [isComplete, onStartScroll]);

    return (
        <div className="fixed inset-0 z-[100] cursor-pointer flex flex-col items-center justify-center bg-black" onClick={onStartScroll}>
            {/* Scanline CRT Effect */}
            <div className="absolute inset-0 pointer-events-none z-50">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0px,rgba(0,0,0,0.15)_1px,transparent_1px,transparent_2px)] opacity-50" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            </div>

            {/* Black Overlay that fades out */}
            <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Boot Messages */}
            {bootPhase === 0 && (
                <div className="absolute top-8 left-8 font-mono text-xs text-green-500/80 z-20">
                    {bootMessages.map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.1 }}
                            className="mb-1"
                        >
                            {msg}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Content that matches Hero Position EXACTLY - for seamless transition */}
            <motion.div
                className="relative z-10 text-center -mt-24 sm:-mt-36 pointer-events-none px-4"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
            >
                {bootPhase >= 1 && (
                    <div className="relative mb-4 sm:mb-6 group cursor-default w-full flex justify-center">
                        <h1 className="font-display text-4xl sm:text-6xl md:text-8xl lg:text-[10rem] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 font-black tracking-tighter uppercase relative z-10 select-none whitespace-nowrap drop-shadow-2xl">
                            {text}
                            {!isComplete && <span className="inline-block w-1 sm:w-2 h-10 sm:h-16 md:h-24 bg-nation-secondary ml-1 sm:ml-2 align-middle animate-blink" />}
                        </h1>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-16 sm:h-24 md:h-32 bg-nation-secondary/10 blur-[80px] -z-10 opacity-50"></div>
                    </div>
                )}

                {isComplete && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                    >
                        <span className="text-[10px] font-mono text-nation-secondary uppercase tracking-widest animate-pulse">
                            Initialize System [Click / Scroll]
                        </span>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

const ParallaxBackground = ({ text, direction = 1 }: { text: string, direction?: number }) => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });
    const x = useTransform(scrollYProgress, [0, 1], [direction * -50, direction * 50]);

    return (
        <div ref={ref} className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
            <motion.div
                style={{ x }}
                className="whitespace-nowrap text-[10vw] md:text-[12vw] font-black font-display text-white opacity-[0.02] uppercase leading-none select-none"
            >
                {text}
            </motion.div>
        </div>
    );
};

const SectionTitle = ({ children, subtitle }: { children?: React.ReactNode, subtitle?: string }) => (
    <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ margin: "-100px", once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-6 sm:mb-8 relative pl-4 sm:pl-6 border-l border-nation-secondary/40 z-10"
    >
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 text-nation-secondary opacity-80">
            <Target size={10} className="animate-spin-slow sm:w-3 sm:h-3" />
            <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.3em]">{subtitle}</span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white uppercase tracking-[0.05em] sm:tracking-[0.1em] text-glow font-bold">
            <GlitchText text={children as string} trigger="view" />
        </h2>
    </motion.div>
);

// ACHIEVEMENTS SECTION - Auto-scrolling horizontal showcase
// Displays club achievements with image, title, and description
// Auto-moves horizontally with fixed interval, loops continuously
const AchievementsSection = () => {
    // Achievement data - static content
    const achievements = [
        {
            id: 1,
            title: "SAE Aero Design Competition",
            description: "Secured top positions in the prestigious SAE Aero Design Challenge, competing against universities worldwide with our innovative aircraft designs and engineering solutions.",
            image: "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?q=80&w=1000&auto=format&fit=crop"
        },
        {
            id: 2,
            title: "National Drone Racing Championship",
            description: "Our drone racing team demonstrated exceptional piloting skills and technical prowess, achieving remarkable results in the national-level competition.",
            image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=1000&auto=format&fit=crop"
        },
        {
            id: 3,
            title: "Inter-NIT Rocketry Meet",
            description: "Launched high-powered rockets achieving record altitudes and precision landings, showcasing our expertise in propulsion systems and aerodynamics.",
            image: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?q=80&w=1000&auto=format&fit=crop"
        },
        {
            id: 4,
            title: "Technical Innovation Award",
            description: "Recognized for developing cutting-edge autonomous flight systems and contributing to aerospace research at the collegiate level.",
            image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?q=80&w=1000&auto=format&fit=crop"
        }
    ];

    // Current achievement index state
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-scroll logic - changes achievement every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % achievements.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [achievements.length]);

    return (
        <section id="achievements" className="py-12 sm:py-20 md:py-24 relative overflow-hidden bg-nation-black">
            <ParallaxBackground text="ACHIEVEMENTS" direction={-1} />
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <SectionTitle subtitle="Milestones">Achievements</SectionTitle>
                <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                    Our journey of excellence in aerospace innovation. From national competitions to groundbreaking projects, these milestones reflect our commitment to pushing boundaries.
                </p>

                {/* Achievement Carousel Container */}
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-nation-panel/20">
                    {/* Achievement Cards - Horizontal sliding animation */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="flex flex-col md:flex-row items-center gap-6 p-6 sm:p-8 lg:p-10"
                        >
                            {/* Achievement Image */}
                            <div className="w-full md:w-1/2 aspect-video rounded-lg overflow-hidden border border-white/10">
                                <img
                                    src={achievements[currentIndex].image}
                                    alt={achievements[currentIndex].title}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Achievement Text Content */}
                            <div className="w-full md:w-1/2 space-y-4">
                                <div className="flex items-center gap-2 text-nation-secondary">
                                    <Trophy size={20} />
                                    <span className="font-mono text-[10px] uppercase tracking-widest">Achievement #{currentIndex + 1}</span>
                                </div>
                                <h3 className="font-display text-xl sm:text-2xl lg:text-3xl text-white font-bold">
                                    {achievements[currentIndex].title}
                                </h3>
                                <p className="text-nation-text text-sm sm:text-base leading-relaxed">
                                    {achievements[currentIndex].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Progress Indicators */}
                    <div className="flex justify-center gap-2 pb-6">
                        {achievements.map((_, index) => (
                            <div
                                key={index}
                                className={`h-1 rounded-full transition-all duration-500 ${index === currentIndex
                                    ? 'w-8 bg-nation-secondary'
                                    : 'w-2 bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* HUD Corners for consistent styling */}
                    <HudCorner position="tl" />
                    <HudCorner position="tr" />
                    <HudCorner position="bl" />
                    <HudCorner position="br" />
                </div>
            </div>
        </section>
    );
};

// COUNCIL SECTION COMPONENT
// Fetches council members from database and displays them in fixed role-based layout
// Photos are synced from member profiles (ID card photos)
// Secretary is displayed as a tag, not a separate position
const CouncilSection = () => {
    const [councilMembers, setCouncilMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch council members from database
    // Auto-updates when council transfer completes (state-driven)
    useEffect(() => {
        const fetchCouncil = async () => {
            const members = await getCouncilMembers();
            setCouncilMembers(members);
            setLoading(false);
        };
        fetchCouncil();

        // Optional: Set up interval to refresh council data periodically
        // This ensures automatic reflection of council changes
        const refreshInterval = setInterval(fetchCouncil, 30000); // Refresh every 30s
        return () => clearInterval(refreshInterval);
    }, []);

    // Fixed role-to-slot mapping - roles define position, not people
    // This ensures layout stability regardless of who holds the role
    const getRoleIcon = (role: string): React.ReactNode => {
        const roleLower = role.toLowerCase();
        if (roleLower.includes('president') && !roleLower.includes('vice')) return <Shield size={20} />;
        if (roleLower.includes('vice president')) return <Star size={20} />;
        if (roleLower.includes('creative')) return <Scroll size={20} />;
        if (roleLower.includes('management') || roleLower.includes('treasurer')) return <Briefcase size={20} />;
        if (roleLower.includes('drone')) return <Hexagon size={16} />;
        if (roleLower.includes('rc') || roleLower.includes('plane')) return <Plane size={16} />;
        if (roleLower.includes('rocket')) return <Rocket size={16} />;
        return <Target size={16} />;
    };

    // Check if member is Secretary (role contains "Secretary")
    // Secretary is a tag only, not a separate card position
    const isSecretary = (member: Member): boolean => {
        return member.role.toLowerCase().includes('secretary');
    };

    // Get display role (remove "Secretary &" prefix if present, Secretary shown as tag)
    const getDisplayRole = (role: string): string => {
        // If role has "Secretary &" or "& Secretary", extract the main role
        // Secretary will be shown as a tag instead
        return role.replace(/secretary\s*&\s*/i, '').replace(/\s*&\s*secretary/i, '').trim();
    };

    // Find member by role pattern - used for fixed slot mapping
    const findMemberByRole = (rolePattern: string): Member | undefined => {
        return councilMembers.find(m => m.role.toLowerCase().includes(rolePattern.toLowerCase()));
    };

    // Fixed layout slots - positions are constant, only occupants change
    const president = findMemberByRole('president');
    const vicePresident = councilMembers.find(m => m.role.toLowerCase().includes('vice president'));
    const creativeHead = findMemberByRole('creative');
    const managementLead = councilMembers.find(m => m.role.toLowerCase().includes('management') || m.role.toLowerCase().includes('treasurer'));
    const droneLead = councilMembers.find(m => m.role.toLowerCase().includes('drone') && m.role.toLowerCase().includes('lead'));
    const rcLead = councilMembers.find(m => m.role.toLowerCase().includes('rc') && m.role.toLowerCase().includes('lead'));
    const rocketLead = councilMembers.find(m => m.role.toLowerCase().includes('rocket') && m.role.toLowerCase().includes('lead'));

    // Fallback data for when database hasn't loaded yet
    const fallbackData = {
        president: { name: 'Deepan K', role: 'President' },
        vicePresident: { name: 'Sreijan Sinha', role: 'Vice President' },
        creativeHead: { name: 'Nirav Sayanja', role: 'Secretary & Creative Head' },
        managementLead: { name: 'Deepa Prajapati', role: 'Management Lead & Treasurer' },
        droneLead: { name: 'Tanya Priyadarshini', role: 'Lead: Drone' },
        rcLead: { name: 'M Sai Krishna', role: 'Lead: RC Plane' },
        rocketLead: { name: 'Amrit Raj Biswal', role: 'Lead: Rocketry' }
    };

    return (
        <section id="squadron" className="py-12 sm:py-20 md:py-24 relative overflow-hidden bg-nation-black">
            <ParallaxBackground text="COUNCIL" direction={-1} />
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <SectionTitle subtitle="Command">The Council</SectionTitle>
                <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                    A multidisciplinary team of pilots, engineers, and strategists working in unison. The Council orchestrates club operations, technical research, and event management to ensure mission success.
                </p>
                {/* Fixed 4-column layout for main council positions */}
                {/* Role-based slot mapping: positions are fixed, only occupants change */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-10 lg:mb-16">
                    {/* Slot 1: President - always first position */}
                    <MemberCard
                        name={president?.name || fallbackData.president.name}
                        role={president ? getDisplayRole(president.role) : fallbackData.president.role}
                        icon={<Shield size={20} />}
                        delay={0}
                        photoUrl={president?.profile_pic}
                        isSecretary={president ? isSecretary(president) : false}
                    />
                    {/* Slot 2: Vice President - always second position */}
                    <MemberCard
                        name={vicePresident?.name || fallbackData.vicePresident.name}
                        role={vicePresident ? getDisplayRole(vicePresident.role) : fallbackData.vicePresident.role}
                        icon={<Star size={20} />}
                        delay={0.1}
                        photoUrl={vicePresident?.profile_pic}
                        isSecretary={vicePresident ? isSecretary(vicePresident) : false}
                    />
                    {/* Slot 3: Creative Head - always third position */}
                    <MemberCard
                        name={creativeHead?.name || fallbackData.creativeHead.name}
                        role={creativeHead ? getDisplayRole(creativeHead.role) : 'Creative Head'}
                        icon={<Scroll size={20} />}
                        delay={0.2}
                        photoUrl={creativeHead?.profile_pic}
                        isSecretary={creativeHead ? isSecretary(creativeHead) : true}
                    />
                    {/* Slot 4: Management Lead & Treasurer - always fourth position */}
                    <MemberCard
                        name={managementLead?.name || fallbackData.managementLead.name}
                        role={managementLead ? getDisplayRole(managementLead.role) : fallbackData.managementLead.role}
                        icon={<Briefcase size={20} />}
                        delay={0.3}
                        photoUrl={managementLead?.profile_pic}
                        isSecretary={managementLead ? isSecretary(managementLead) : false}
                    />
                </div>
                <div>
                    <h3 className="font-mono text-[9px] lg:text-[10px] uppercase tracking-[0.2em] lg:tracking-[0.3em] text-nation-text/60 mb-4 lg:mb-6 flex items-center gap-3 lg:gap-4">
                        <span className="w-6 lg:w-8 h-[1px] bg-white/10"></span>Squadron Leaders
                    </h3>
                    {/* Centered 3-column layout for squadron leaders - same card size as top row */}
                    <div className="flex justify-center">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-6 w-full sm:w-3/4">
                            {/* Slot 5: Drone Lead - always first in squadron row */}
                            <MemberCard
                                name={droneLead?.name || fallbackData.droneLead.name}
                                role={droneLead ? getDisplayRole(droneLead.role) : fallbackData.droneLead.role}
                                icon={<Hexagon size={16} />}
                                delay={0.4}
                                photoUrl={droneLead?.profile_pic}
                                isSecretary={droneLead ? isSecretary(droneLead) : false}
                            />
                            {/* Slot 6: RC Lead - always second in squadron row */}
                            <MemberCard
                                name={rcLead?.name || fallbackData.rcLead.name}
                                role={rcLead ? getDisplayRole(rcLead.role) : fallbackData.rcLead.role}
                                icon={<Plane size={16} />}
                                delay={0.5}
                                photoUrl={rcLead?.profile_pic}
                                isSecretary={rcLead ? isSecretary(rcLead) : false}
                            />
                            {/* Slot 7: Rocket Lead - always third in squadron row */}
                            <MemberCard
                                name={rocketLead?.name || fallbackData.rocketLead.name}
                                role={rocketLead ? getDisplayRole(rocketLead.role) : fallbackData.rocketLead.role}
                                icon={<Rocket size={16} />}
                                delay={0.6}
                                photoUrl={rocketLead?.profile_pic}
                                isSecretary={rocketLead ? isSecretary(rocketLead) : false}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const HudCorner = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
    const classes = {
        tl: 'top-0 left-0 border-t border-l rounded-tl-lg',
        tr: 'top-0 right-0 border-t border-r rounded-tr-lg',
        bl: 'bottom-0 left-0 border-b border-l rounded-bl-lg',
        br: 'bottom-0 right-0 border-b border-r rounded-br-lg',
    };
    return <div className={`absolute w-6 h-6 border-nation-secondary/30 ${classes[position]}`} />;
};

const LiveMetric = ({ label, value, unit, icon: Icon }: { label: string, value: string | number, unit: string, icon: any }) => {
    const [displayVal, setDisplayVal] = useState(Number(value) || 0);

    useEffect(() => {
        if (typeof value === 'number') {
            const i = setInterval(() => {
                setDisplayVal(prev => +(prev + (Math.random() - 0.5) * (prev * 0.05)).toFixed(1));
            }, 1000);
            return () => clearInterval(i);
        }
    }, [value]);

    return (
        <div className="flex flex-col gap-1 p-2 bg-black/40 border border-white/5 rounded-sm overflow-hidden">
            <div className="flex items-center gap-1.5 text-nation-text/60">
                <Icon size={9} />
                <span className="text-[7px] font-mono uppercase tracking-wider whitespace-nowrap">{label}</span>
            </div>
            <div className="text-[9px] font-mono text-white font-bold truncate">
                {typeof value === 'number' ? displayVal : value} <span className="text-[7px] font-normal text-nation-text">{unit}</span>
            </div>
        </div>
    )
}

const MemberCard = ({ name, role, icon, delay, photoUrl, isSecretary }: {
    name: string,
    role: string,
    icon?: React.ReactNode,
    delay: number,
    photoUrl?: string,  // Profile photo URL from database
    isSecretary?: boolean  // Secretary indicator - shown as part of role text
}) => {
    // Build display role - prepend "Secretary & " if applicable
    const displayRole = isSecretary ? `Secretary & ${role}` : role;

    return (
        <div
            className="flex flex-col group bg-nation-panel/40 backdrop-blur-md border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 w-full relative overflow-hidden rounded-lg hover:bg-nation-panel/80 h-full"
        >
            {/* Clearance badge - top right corner with improved visibility */}
            <div className="absolute top-2 right-2 lg:top-3 lg:right-3 z-10 text-[7px] lg:text-[9px] font-mono uppercase tracking-widest text-right leading-tight bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
                <span className="text-white/70">Clearance</span><br />
                <span className="text-nation-secondary font-bold">Lvl 5</span>
            </div>

            {/* Large photo area at top - rectangular with rounded corners */}
            <div className="p-3 lg:p-4">
                <div className="aspect-[4/5] w-full rounded-xl overflow-hidden bg-gray-300/10 border border-white/5">
                    {photoUrl ? (
                        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-nation-panel to-nation-void">
                            <div className="text-nation-secondary opacity-50">
                                {icon || <Target size={48} />}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Name and Role below photo */}
            <div className="px-3 lg:px-4 pb-4 lg:pb-5 text-center flex-1 flex flex-col justify-end">
                <h3 className="font-display text-sm lg:text-lg text-white mb-2 uppercase tracking-[0.05em] lg:tracking-[0.1em] group-hover:text-nation-secondary transition-colors font-bold">
                    <GlitchText text={name} trigger="view" />
                </h3>

                {/* Role display - Secretary shown as part of role text */}
                <p className="text-[9px] lg:text-xs font-bold font-mono text-nation-text/60 uppercase tracking-[0.1em] lg:tracking-[0.15em] border-t border-white/5 pt-2">
                    {displayRole}
                </p>
            </div>
        </div>
    );
};

interface EventDetails {
    title: string;
    subtitle: string;
    date: string;
    venue?: string;
    prize?: string;
    registrationCount: number;
    description?: string;
    rules?: string[];
    timeline?: { time: string; activity: string }[];
}

// REGISTRABLE_EVENTS: Only these events support registration (all others show View Details only)
const REGISTRABLE_EVENTS = ['aeroprix', 'hovermania'];

const PosterCard = ({ title, subtitle, date, venue, prize, imgSrc, colorClass = "text-nation-secondary", delay = 0, onRegister, isTeamMember = false, registrationCount = 0, onDetails, registrationOpen = true, eventId }: { title: string, subtitle: string, date: string, venue?: string, prize?: string, imgSrc: string, colorClass?: string, delay?: number, onRegister?: () => void, isTeamMember?: boolean, registrationCount?: number, onDetails?: () => void, registrationOpen?: boolean, eventId?: string }) => {
    // Only show registration for registrable events (Aeroprix, Hovermania)
    const isRegistrable = eventId ? REGISTRABLE_EVENTS.includes(eventId.toLowerCase()) : false;

    return (
        <div
            className="group relative h-[360px] lg:h-[500px] w-full overflow-hidden bg-nation-panel border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg"
        >
            <div className="absolute inset-0 w-full h-full">
                <img src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 filter grayscale hover:grayscale-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-500"></div>
            </div>
            <div className="absolute top-3 right-3 lg:top-4 lg:right-4 z-20 flex gap-1.5 lg:gap-2">
                {/* Only show registration status for registrable events */}
                {isTeamMember && isRegistrable && !registrationOpen && (
                    <span className="bg-red-500 text-white text-[8px] lg:text-[9px] font-bold px-2 lg:px-3 py-0.5 lg:py-1 font-mono uppercase tracking-widest flex items-center gap-1 rounded-sm">
                        Registrations Off
                    </span>
                )}
                {isTeamMember && isRegistrable && registrationOpen && (
                    <span className="bg-green-500 text-black text-[8px] lg:text-[9px] font-bold px-2 lg:px-3 py-0.5 lg:py-1 font-mono uppercase tracking-widest flex items-center gap-1 rounded-sm">
                        <UsersIcon size={10} /> {registrationCount} Registered
                    </span>
                )}
                {prize && <span className="bg-nation-secondary text-black text-[8px] lg:text-[9px] font-bold px-2 lg:px-3 py-0.5 lg:py-1 font-mono uppercase tracking-widest flex items-center gap-1 rounded-sm"><Trophy size={10} /> {prize}</span>}
            </div>
            <div className="absolute bottom-0 left-0 w-full p-4 lg:p-6 z-20 bg-black/80 backdrop-blur-md border-t border-white/10">
                <div>
                    <div className="flex items-center gap-1.5 lg:gap-2 mb-1.5 lg:mb-2">
                        <span className="bg-white/10 text-white text-[7px] lg:text-[8px] px-1.5 lg:px-2 py-0.5 font-mono uppercase tracking-widest border border-white/10 rounded-full">Innovision '25</span>
                        {isTeamMember && (
                            <span className="bg-green-500/20 text-green-400 text-[7px] lg:text-[8px] px-1.5 lg:px-2 py-0.5 font-mono uppercase tracking-widest border border-green-500/30 rounded-full">Team Access</span>
                        )}
                    </div>
                    <h3 className={`text-lg lg:text-2xl font-display uppercase tracking-wider mb-1 font-bold ${colorClass}`}>{title}</h3>
                    <p className="text-[8px] lg:text-[10px] font-mono text-white/80 uppercase tracking-[0.1em] lg:tracking-[0.2em] mb-2 lg:mb-4">{subtitle}</p>
                    <div className="grid grid-cols-2 gap-1 lg:gap-2 border-t border-white/10 pt-2 lg:pt-4 mb-2 lg:mb-4">
                        <div className="flex items-center gap-1 lg:gap-2 text-nation-text text-[7px] lg:text-[9px] font-mono uppercase tracking-wider">
                            <Calendar size={10} className="lg:w-3 lg:h-3" />
                            <span>{date}</span>
                        </div>
                        {venue && (
                            <div className="flex items-center gap-1.5 lg:gap-2 text-nation-text text-[7px] lg:text-[9px] font-mono uppercase tracking-wider">
                                <MapPin size={10} className="lg:w-3 lg:h-3" />
                                <span>{venue}</span>
                            </div>
                        )}
                    </div>
                    <Magnetic>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Non-registrable events always show View Details
                                // Team members also see View Details (for all events)
                                if (!isRegistrable || isTeamMember) {
                                    if (onDetails) onDetails();
                                } else if (onRegister) {
                                    onRegister();
                                }
                            }}
                            className={`w-full py-2.5 lg:py-3 border bg-transparent hover:bg-white hover:text-black transition-all text-[9px] lg:text-[10px] font-mono uppercase tracking-[0.15em] lg:tracking-[0.2em] cursor-pointer flex items-center justify-center gap-2 rounded-sm ${(isTeamMember || !isRegistrable) ? 'border-green-500 text-green-400 hover:bg-green-500 hover:text-black' : colorClass === 'text-nation-secondary' ? 'border-nation-secondary text-nation-secondary' : 'border-white text-white'}`}
                        >
                            {/* Show View Details for: team members OR non-registrable events */}
                            {(isTeamMember || !isRegistrable) ? (<><Eye size={14} /> View Details</>) : 'Register'}
                        </button>
                    </Magnetic>
                </div>
            </div>
        </div>
    );
};

const SupportUnitCard = ({ title, role, icon, delay }: { title: string, role: string, icon: React.ReactNode, delay: number }) => (
    <div
        className="group flex items-center gap-6 p-6 bg-nation-panel/60 backdrop-blur-sm border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 w-full rounded-lg hover:bg-nation-panel/80"
    >
        <div className="w-16 h-16 flex items-center justify-center border border-white/10 rounded-lg text-white/80 bg-black group-hover:text-nation-secondary group-hover:border-nation-secondary/50 transition-all shadow-lg">
            {icon}
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-start">
                <h3 className="font-display text-lg text-white uppercase tracking-widest mb-1 group-hover:text-nation-secondary transition-colors">{title}</h3>
                <div className="transform -rotate-90 text-nation-text/20 group-hover:text-nation-secondary transition-colors">
                    <ArrowDown size={16} />
                </div>
            </div>
            <p className="text-[10px] font-mono text-nation-text uppercase tracking-[0.2em] border-t border-white/5 pt-2 mt-1">{role}</p>
        </div>
    </div>
);

// Event data (registration counts fetched from Supabase)
const eventsData: { [key: string]: EventDetails } = {
    'aeroprix': {
        title: 'Aeroprix',
        subtitle: 'RC Plane Battle',
        date: 'Nov 8th, Sat',
        venue: 'STS Grounds',
        prize: '15K Pool',
        registrationCount: 0, // Will be updated from Supabase
        description: 'Aeroprix is the flagship RC plane competition of UDAAN where teams design, build, and fly their own radio-controlled aircraft. Test your engineering skills and piloting abilities in Eastern India\'s largest aeromodelling event.',
        rules: [
            'Team size: 2-5 members',
            'Wingspan must not exceed 1.5 meters',
            'Only electric propulsion allowed',
            'All aircraft must pass safety inspection',
            'Pilots must complete test flight before competition'
        ],
        timeline: [
            { time: '9:00 AM', activity: 'Registration & Check-in' },
            { time: '10:00 AM', activity: 'Safety Inspection' },
            { time: '11:00 AM', activity: 'Test Flights' },
            { time: '1:00 PM', activity: 'Competition Rounds Begin' },
            { time: '4:00 PM', activity: 'Finals' },
            { time: '5:00 PM', activity: 'Prize Distribution' }
        ]
    },
    'hovermania': {
        title: 'Hovermania',
        subtitle: 'Hovercraft Battle',
        date: 'Nov 9th, Sun',
        venue: 'LA Lawns',
        prize: '8K Pool',
        registrationCount: 0,
        description: 'Hovermania challenges participants to build hovercrafts that can navigate obstacles, race against time, and battle opponents. A unique blend of engineering and strategy.',
        rules: [
            'Team size: 2-4 members',
            'Hovercraft dimensions: max 60cm x 60cm',
            'Weight limit: 3kg',
            'Must use provided power source',
            'Remote control range: minimum 10 meters'
        ],
        timeline: [
            { time: '10:00 AM', activity: 'Registration & Check-in' },
            { time: '11:00 AM', activity: 'Technical Inspection' },
            { time: '12:00 PM', activity: 'Practice Runs' },
            { time: '2:00 PM', activity: 'Knockout Rounds' },
            { time: '4:00 PM', activity: 'Finals & Prize Distribution' }
        ]
    },
    'aviation-sim': {
        title: 'Aviation Sim',
        subtitle: 'Pilot Experience',
        date: 'Nov 9th, Sun',
        venue: 'LA Lawns',
        prize: undefined,
        registrationCount: 0,
        description: 'Experience the thrill of flying with our state-of-the-art flight simulators. From beginners to aviation enthusiasts, test your skills in various aircraft and weather conditions.',
        rules: [
            'Individual participation',
            'Three difficulty levels available',
            'Best of 3 attempts scored',
            'Realistic cockpit controls',
            'Multiple aircraft options'
        ],
        timeline: [
            { time: '10:00 AM - 5:00 PM', activity: 'Open for all participants' },
            { time: 'Every 30 mins', activity: 'Leaderboard updates' },
            { time: '5:00 PM', activity: 'Top 3 announced' }
        ]
    }
};

// Event Details Modal Component
const EventDetailsModal = ({ event, onClose }: { event: EventDetails | null, onClose: () => void }) => {
    if (!event) return null;

    // Prevent body scroll when modal is open
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-white/10 shadow-2xl"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header - Fixed */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-nation-secondary/20 to-transparent rounded-t-2xl flex-shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-green-500/20 text-green-400 text-[10px] px-3 py-1 font-mono uppercase tracking-widest border border-green-500/30 rounded-full flex items-center gap-1">
                                        <CheckCircle size={12} /> Team Access
                                    </span>
                                </div>
                                <h2 className="text-3xl font-display text-white uppercase tracking-wider font-bold">{event.title}</h2>
                                <p className="text-nation-text font-mono text-sm uppercase tracking-widest mt-1">{event.subtitle}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white/60 hover:text-white transition-colors p-2"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div
                        className="flex-1 overflow-y-auto overscroll-contain"
                        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
                        onWheel={(e) => e.stopPropagation()}
                    >
                        {/* Stats Bar */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-black/40 border-b border-white/10">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                                    <UsersIcon size={18} />
                                    <span className="text-2xl font-bold">{event.registrationCount}</span>
                                </div>
                                <p className="text-[10px] font-mono text-nation-text uppercase tracking-wider">Registrations</p>
                            </div>
                            <div className="text-center border-x border-white/10">
                                <div className="flex items-center justify-center gap-2 text-nation-secondary mb-1">
                                    <Calendar size={18} />
                                    <span className="text-sm font-bold">{event.date}</span>
                                </div>
                                <p className="text-[10px] font-mono text-nation-text uppercase tracking-wider">Event Date</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 text-yellow-400 mb-1">
                                    <MapPin size={18} />
                                    <span className="text-sm font-bold">{event.venue || 'TBA'}</span>
                                </div>
                                <p className="text-[10px] font-mono text-nation-text uppercase tracking-wider">Venue</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Description */}
                            <div>
                                <h3 className="text-white font-display uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                                    <Target size={14} className="text-nation-secondary" /> About
                                </h3>
                                <p className="text-nation-text text-sm leading-relaxed">{event.description}</p>
                            </div>

                            {/* Prize */}
                            {event.prize && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <Trophy size={24} className="text-yellow-400" />
                                        <div>
                                            <p className="text-[10px] font-mono text-yellow-400/80 uppercase tracking-wider">Prize Pool</p>
                                            <p className="text-2xl font-bold text-yellow-400">{event.prize}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rules */}
                            {event.rules && (
                                <div>
                                    <h3 className="text-white font-display uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                                        <Scroll size={14} className="text-nation-secondary" /> Rules
                                    </h3>
                                    <ul className="space-y-2">
                                        {event.rules.map((rule, i) => (
                                            <li key={i} className="flex items-start gap-2 text-nation-text text-sm">
                                                <span className="text-nation-secondary mt-1">•</span>
                                                {rule}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Timeline */}
                            {event.timeline && (
                                <div>
                                    <h3 className="text-white font-display uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                                        <Clock size={14} className="text-nation-secondary" /> Event Timeline
                                    </h3>
                                    <div className="space-y-2">
                                        {event.timeline.map((item, i) => (
                                            <div key={i} className="flex items-center gap-4 bg-white/5 rounded-lg p-3">
                                                <span className="text-nation-secondary font-mono text-xs font-bold min-w-[100px]">{item.time}</span>
                                                <span className="text-white text-sm">{item.activity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Fixed */}
                    <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-2xl flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-mono text-nation-text/60 uppercase tracking-wider">
                                Last updated: {new Date().toLocaleDateString()}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-nation-secondary text-black font-bold text-xs uppercase tracking-wider rounded hover:bg-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// --- MAIN CONTENT ---
const MainContent = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [introDismissed, setIntroDismissed] = useState(() => {
        // Check if user has already seen the intro this session
        // Also skip intro when returning from another page (e.g. dashboard)
        const hasSeenIntro = sessionStorage.getItem('introDismissed') === 'true';
        const isNavigatingBack = sessionStorage.getItem('navigatedAway') === 'true';
        // Skip the intro if user either dismissed it previously OR is navigating back
        return hasSeenIntro || isNavigatingBack;
    });
    const [activeSection, setActiveSection] = useState('mission');
    const [showInductionClosed, setShowInductionClosed] = useState(false);
    const [showRegistrationClosed, setShowRegistrationClosed] = useState(false);
    const [showAlreadyMember, setShowAlreadyMember] = useState(false);
    const [induction1stYearOpen, setInduction1stYearOpen] = useState(false); // Default to false, will be updated from config
    const [induction2ndYearOpen, setInduction2ndYearOpen] = useState(false); // Default to false, will be updated from config
    const [registrationOpen, setRegistrationOpen] = useState(false); // Default to false, will be updated from config
    const [isTeamMember, setIsTeamMember] = useState(false); // Track if user is logged in as team member
    const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null); // For event details modal
    const [registrationCounts, setRegistrationCounts] = useState<{ [key: string]: number }>({}); // Dynamic registration counts from Supabase
    const { musicPlaying, toggleMusic } = useAudio();
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 500], [0, 150]);
    const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
    const navigate = useNavigate();

    // Fetch registration counts from Supabase
    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const counts = await getAllRegistrationCounts();
                setRegistrationCounts(counts);
            } catch (err) {
                // Error handled silently in production
            }
        };
        fetchCounts();
    }, []);

    // Check if user is logged in as team member
    useEffect(() => {
        const checkTeamLogin = () => {
            const memberId = sessionStorage.getItem('udaanMemberId');
            setIsTeamMember(!!memberId);
        };
        checkTeamLogin();
        // Also listen for storage changes (in case user logs in/out in another tab)
        window.addEventListener('storage', checkTeamLogin);
        return () => window.removeEventListener('storage', checkTeamLogin);
    }, []);

    // navigate to team login while marking that user navigated away
    const goToTeamLogin = () => {
        try { sessionStorage.setItem('navigatedAway', 'true'); } catch (err) { }
        navigate('/team-login');
    };

    // Open event details modal with dynamic count
    const handleViewEventDetails = (eventKey: string) => {
        const event = eventsData[eventKey];
        if (event) {
            // Merge static event data with dynamic registration count
            setSelectedEvent({
                ...event,
                registrationCount: registrationCounts[eventKey] || 0
            });
        }
    };

    // Fetch induction and registration status from config.json
    useEffect(() => {
        fetch('/config.json')
            .then(response => {
                if (!response.ok) throw new Error('Config not found');
                return response.json();
            })
            .then(data => {
                // Use nullish coalescing to handle missing/undefined values
                setInduction1stYearOpen(data?.induction1stYearOpen ?? false);
                setInduction2ndYearOpen(data?.induction2ndYearOpen ?? false);
                setRegistrationOpen(data?.registrationOpen ?? false);
            })
            .catch(error => {
                console.error('Error fetching config:', error);
                setInduction1stYearOpen(false); // Default to closed on error
                setInduction2ndYearOpen(false);
                setRegistrationOpen(false);
            });
    }, []);

    // Handle Join Corps button click - check if any induction is open
    const handleJoinCorps = () => {
        // First check if user is already a team member
        if (isTeamMember) {
            // Play reject sound and show "already a member" modal
            try {
                (window as any).__suppressClickAudio = true;
                const ref = (window as any).__appClickRefs?.reject || null;
                if (ref && ref.play) {
                    ref.currentTime = 0;
                    ref.play().catch(() => { });
                } else {
                    const globalRef = (globalThis as any).rejectAudioRef;
                    if (globalRef && globalRef.play) { globalRef.currentTime = 0; globalRef.play().catch(() => { }); }
                }
            } catch (err) { }
            setShowAlreadyMember(true);
            setTimeout(() => { try { delete (window as any).__suppressClickAudio; } catch { } }, 250);
            return;
        }

        const anyInductionOpen = induction1stYearOpen || induction2ndYearOpen;

        if (anyInductionOpen) {
            // play click sound explicitly (in case global handler is suppressed)
            try { if ((window as any).__suppressClickAudio) delete (window as any).__suppressClickAudio; } catch { }
            const a = (window as any).document ? null : null;
            navigate('/join-corps');
        } else {
            // play reject sound and show modal (if closed OR past deadline)
            try {
                (window as any).__suppressClickAudio = true;
            } catch { }
            try {
                const ref = (window as any).__appClickRefs?.reject || null;
                if (ref && ref.play) {
                    ref.currentTime = 0;
                    ref.play().catch(() => { });
                } else {
                    // try common global ref
                    const globalRef = (globalThis as any).rejectAudioRef;
                    if (globalRef && globalRef.play) { globalRef.currentTime = 0; globalRef.play().catch(() => { }); }
                }
            } catch (err) { }
            setShowInductionClosed(true);
            setTimeout(() => { try { delete (window as any).__suppressClickAudio; } catch { } }, 250);
        }
    };

    // Handle Register button click
    const handleRegister = () => {
        if (registrationOpen) {
            try { if ((window as any).__suppressClickAudio) delete (window as any).__suppressClickAudio; } catch { }
            navigate('/register');
        } else {
            try {
                (window as any).__suppressClickAudio = true;
            } catch { }
            try {
                const ref = (window as any).__appClickRefs?.reject || null;
                if (ref && ref.play) {
                    ref.currentTime = 0;
                    ref.play().catch(() => { });
                } else {
                    const globalRef = (globalThis as any).rejectAudioRef;
                    if (globalRef && globalRef.play) { globalRef.currentTime = 0; globalRef.play().catch(() => { }); }
                }
            } catch (err) { }
            setShowRegistrationClosed(true);
            setTimeout(() => { try { delete (window as any).__suppressClickAudio; } catch { } }, 250);
        }
    };

    // Clear navigatedAway flag on mount (fresh page load)
    useEffect(() => {
        // On initial mount, reset the navigatedAway flag
        sessionStorage.removeItem('navigatedAway');
    }, []);

    // Save intro dismissed state to sessionStorage
    const handleIntroDismiss = () => {
        setIntroDismissed(true);
        sessionStorage.setItem('introDismissed', 'true');
    };

    // Track active section based on scroll position
    useEffect(() => {
        const sections = ['mission', 'fleet', 'telemetry', 'events', 'squadron', 'team'];

        const handleScroll = () => {
            const scrollPosition = window.scrollY + 150; // Offset for navbar

            for (let i = sections.length - 1; i >= 0; i--) {
                const section = document.getElementById(sections[i]);
                if (section && section.offsetTop <= scrollPosition) {
                    setActiveSection(sections[i]);
                    break;
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Smooth Scroll Initialization
    useEffect(() => {
        // Only initialize Lenis after intro is dismissed to avoid conflicts with overflow: hidden
        if (introDismissed) {
            // Force reset scroll to absolute top immediately
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;

            // Completely remove the style properties to allow CSS to take over
            document.body.style.removeProperty('overflow');
            document.documentElement.style.removeProperty('overflow');

            // Small delay before initializing Lenis to ensure scroll is at top
            const timeout = setTimeout(() => {
                const lenis = new Lenis();
                function raf(time: number) {
                    lenis.raf(time);
                    requestAnimationFrame(raf);
                }
                requestAnimationFrame(raf);
            }, 50);

            return () => {
                clearTimeout(timeout);
            }
        } else {
            // Enforce lock when intro is active
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }
    }, [introDismissed]);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            setMenuOpen(false);
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <>
            <AnimatePresence>
                {!introDismissed && <TypewriterIntro onStartScroll={handleIntroDismiss} />}
            </AnimatePresence>

            {/* Induction Closed Modal */}
            <AnimatePresence>
                {showInductionClosed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                        onClick={() => setShowInductionClosed(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-nation-panel border border-white/10 rounded-lg p-8 max-w-md text-center relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                                <X size={32} className="text-red-500" />
                            </div>

                            <h3 className="font-display text-2xl text-white uppercase tracking-widest mb-4">
                                Oops!
                            </h3>
                            <p className="text-nation-text mb-6 text-sm leading-relaxed">
                                We are not currently inducting new members. Stay tuned to our social media for announcements about our next recruitment drive!
                            </p>

                            <div className="flex gap-4 justify-center mb-4">
                                <a href="#" className="w-10 h-10 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full">
                                    <Instagram size={18} />
                                </a>
                                <a href="#" className="w-10 h-10 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full">
                                    <Linkedin size={18} />
                                </a>
                            </div>

                            <button
                                onClick={() => setShowInductionClosed(false)}
                                className="px-6 py-3 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.2em] text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant"
                            >
                                Got It
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Already a Member Modal */}
            <AnimatePresence>
                {showAlreadyMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                        onClick={() => setShowAlreadyMember(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-nation-panel border border-white/10 rounded-lg p-8 max-w-md text-center relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
                                <UsersIcon size={32} className="text-yellow-500" />
                            </div>

                            <h3 className="font-display text-2xl text-white uppercase tracking-widest mb-4">
                                Already Part of the Crew!
                            </h3>
                            <p className="text-nation-text mb-6 text-sm leading-relaxed">
                                You're already a member of UDAAN! Head to your dashboard to manage your profile and access team features.
                            </p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setShowAlreadyMember(false)}
                                    className="px-6 py-3 border border-white/20 text-nation-text font-display font-bold uppercase tracking-[0.2em] text-xs hover:border-white/50 hover:text-white transition-all duration-300"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAlreadyMember(false);
                                        navigate('/team-login');
                                    }}
                                    className="px-6 py-3 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.2em] text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant"
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Registration Closed Modal */}
            <AnimatePresence>
                {showRegistrationClosed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                        onClick={() => setShowRegistrationClosed(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-nation-panel border border-white/10 rounded-lg p-8 max-w-md text-center relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <HudCorner position="tl" />
                            <HudCorner position="tr" />
                            <HudCorner position="bl" />
                            <HudCorner position="br" />

                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                                <X size={32} className="text-red-500" />
                            </div>

                            <h3 className="font-display text-2xl text-white uppercase tracking-widest mb-4">
                                Oops!
                            </h3>
                            <p className="text-nation-text mb-6 text-sm leading-relaxed">
                                Event registrations are currently closed. Stay tuned to our social media for announcements about upcoming events!
                            </p>

                            <div className="flex gap-4 justify-center mb-4">
                                <a href="#" className="w-10 h-10 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full">
                                    <Instagram size={18} />
                                </a>
                                <a href="#" className="w-10 h-10 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full">
                                    <Linkedin size={18} />
                                </a>
                            </div>

                            <button
                                onClick={() => setShowRegistrationClosed(false)}
                                className="px-6 py-3 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.2em] text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant"
                            >
                                Got It
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`bg-nation-black min-h-screen text-white relative`}>

                {/* NAVIGATION */}
                <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 md:px-12 py-3 sm:py-4 glass-dark border-b border-white/10">
                    <div className="container mx-auto flex justify-between items-center">

                        {/* Left Side: Identity */}
                        <Magnetic>
                            <div className="flex items-center gap-3 sm:gap-5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                                    <img src="/udaan-logo.webp" alt="Udaan" className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                                </div>
                                <div className="hidden sm:flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                                        <img src="/nitr-logo.svg" alt="NITR" className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-display font-bold text-xs sm:text-sm uppercase tracking-widest text-white">UDAAN</span>
                                        <div className="flex items-center gap-1 text-[7px] sm:text-[8px] font-mono text-nation-secondary tracking-widest uppercase">
                                            <MapPin size={8} />
                                            <span>22.2513° N, 84.9049° E</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Magnetic>

                        {/* Right Side: Navigation */}
                        <div className="hidden md:flex gap-6 items-center justify-end">
                            {[
                                { label: 'About', id: 'mission' },
                                { label: 'Divisions', id: 'fleet' },
                                { label: 'Data', id: 'telemetry' },
                                { label: 'Events', id: 'events' },
                                { label: 'Council', id: 'squadron' }
                            ].map((item) => (
                                <Magnetic key={item.id}>
                                    <button
                                        onClick={() => scrollToSection(item.id)}
                                        className={`relative text-[10px] font-display font-bold uppercase tracking-[0.2em] transition-colors duration-300 px-4 py-2 ${activeSection === item.id
                                            ? 'text-white'
                                            : 'text-nation-text hover:text-white'
                                            }`}
                                    >
                                        <span className="relative z-10">{item.label}</span>
                                        {activeSection === item.id && (
                                            <motion.div
                                                layoutId="activeNavIndicator"
                                                className="absolute inset-0 bg-nation-secondary clip-path-slant shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                                style={{ zIndex: 0 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 35,
                                                    mass: 0.8
                                                }}
                                            />
                                        )}
                                    </button>
                                </Magnetic>
                            ))}

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleMusic();
                                }}
                                className={`transition-colors ${musicPlaying ? 'text-nation-secondary' : 'text-nation-text hover:text-white'}`}
                                title={musicPlaying ? "Pause music" : "Play music"}
                            >
                                {musicPlaying ? <Music2 size={16} /> : <Music size={16} />}
                            </button>

                            <button
                                onClick={goToTeamLogin}
                                className="text-nation-text hover:text-nation-secondary transition-colors"
                                title="Member Portal"
                            >
                                <User size={16} />
                            </button>
                        </div>

                        <button className="md:hidden text-white pt-2 hover:text-nation-secondary transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
                            {menuOpen ? <X /> : <Menu />}
                        </button>
                    </div>

                    {/* Mobile menu - Full parity with desktop nav
                        Includes all nav items + music toggle + member portal */}
                    {menuOpen && (
                        <div className="md:hidden absolute top-full left-0 w-full bg-black/95 border-b border-nation-secondary/20 backdrop-blur-xl p-6 flex flex-col gap-4 animate-fade-in z-50 shadow-2xl">
                            {[
                                { label: 'About', id: 'mission' },
                                { label: 'Divisions', id: 'fleet' },
                                { label: 'Data', id: 'telemetry' },
                                { label: 'Events', id: 'events' },
                                { label: 'Council', id: 'squadron' }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className="text-base font-display text-white hover:text-nation-secondary uppercase tracking-widest text-left py-2"
                                >
                                    {item.label}
                                </button>
                            ))}

                            {/* Divider */}
                            <div className="border-t border-white/10 my-2"></div>

                            {/* Music toggle - mobile parity with desktop */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleMusic();
                                }}
                                className={`flex items-center gap-3 py-2 text-left ${musicPlaying ? 'text-nation-secondary' : 'text-white hover:text-nation-secondary'}`}
                            >
                                {musicPlaying ? <Music2 size={18} /> : <Music size={18} />}
                                <span className="text-sm font-display uppercase tracking-widest">
                                    {musicPlaying ? 'Pause Music' : 'Play Music'}
                                </span>
                            </button>

                            {/* Member Portal - mobile parity with desktop */}
                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    goToTeamLogin();
                                }}
                                className="flex items-center gap-3 py-2 text-white hover:text-nation-secondary text-left"
                            >
                                <User size={18} />
                                <span className="text-sm font-display uppercase tracking-widest">Member Portal</span>
                            </button>
                        </div>
                    )}
                </nav>

                {/* HERO SECTION */}
                <section className="relative h-screen flex items-center justify-center overflow-hidden">
                    <HeroScene />

                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-nation-void pointer-events-none"></div>

                    <motion.div
                        style={{ y: heroY, opacity: heroOpacity }}
                        className="container mx-auto px-6 relative z-10 text-center -mt-36"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.5 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 mb-6 sm:mb-8 px-3 sm:px-4 py-1 sm:py-1.5 border border-white/10 bg-black/40 rounded-full backdrop-blur-sm w-auto max-w-full justify-center"
                        >
                            <span className="w-1.5 h-1.5 bg-nation-secondary rounded-full animate-pulse flex-shrink-0"></span>
                            <span className="text-[8px] sm:text-[9px] font-mono text-nation-secondary uppercase tracking-widest font-semibold truncate">Technical Society • SAC</span>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: false, amount: 0.5 }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="relative mb-4 sm:mb-6 group cursor-default w-full flex justify-center px-4"
                        >
                            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 font-black tracking-tighter uppercase relative z-10 hover:scale-[1.01] transition-transform duration-700 select-none whitespace-nowrap drop-shadow-2xl">
                                <GlitchText text="UDAAN" trigger="view" />
                            </h1>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-16 sm:h-24 md:h-32 bg-nation-secondary/10 blur-[80px] -z-10 opacity-50 group-hover:opacity-80 transition-opacity duration-700"></div>
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.5 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-nation-text font-mono text-[10px] sm:text-xs md:text-sm lg:text-lg uppercase tracking-[0.15em] sm:tracking-[0.2em] max-w-5xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4"
                        >
                            Aeromodelling Club of NIT Rourkela <br />
                            <span className="text-nation-secondary font-bold mt-2 sm:mt-3 block md:inline md:mt-0 text-glow text-xs sm:text-sm md:text-xl">Design. Build. Fly.</span>
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.5 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center items-center px-4 sm:px-6"
                        >
                            {/*
                      CTA Toggle Logic:
                      - Driven by existing induction toggles fetched into state
                      - When any induction is active, hide the Register button and
                        make Join Corps the primary filled action (centered)
                      - When no induction active, restore original two-button layout
                    */}
                            {(() => {
                                // CTA Priority Logic:
                                // Case 1: Induction enabled -> show single centered filled "Induction" button
                                // Case 2: Registration enabled and induction disabled -> show single centered filled "Register" button
                                // Case 3: Both disabled -> show original both-button layout (Register + Induction (outline))
                                const inductionActive = induction1stYearOpen || induction2ndYearOpen;
                                const registrationActive = registrationOpen;

                                if (inductionActive) {
                                    // Check if deadline has passed (Feb 9, 2026 at 11:59 PM IST)
                                    const deadline = new Date('2026-02-09T23:59:00+05:30');
                                    const now = new Date();
                                    const isDeadlinePassed = now > deadline;

                                    return (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                                {isDeadlinePassed ? (
                                                    <Magnetic>
                                                        <button
                                                            disabled
                                                            className="px-5 sm:px-8 py-2.5 sm:py-4 bg-gray-500 text-white/50 font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs cursor-not-allowed clip-path-slant"
                                                        >
                                                            Induction Apply
                                                        </button>
                                                    </Magnetic>
                                                ) : (
                                                    <Magnetic>
                                                        <button
                                                            onClick={handleJoinCorps}
                                                            className="px-5 sm:px-8 py-2.5 sm:py-4 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant shadow-lg"
                                                        >
                                                            Induction Apply
                                                        </button>
                                                    </Magnetic>
                                                )}

                                                <Magnetic>
                                                    <button
                                                        onClick={() => { try { sessionStorage.setItem('navigatedAway', 'true'); } catch { }; navigate('/induction-login'); }}
                                                        className="px-5 sm:px-8 py-2.5 sm:py-4 bg-transparent border border-white/20 text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs hover:border-nation-secondary hover:text-nation-secondary transition-all duration-300 clip-path-slant"
                                                    >
                                                        Induction Login
                                                    </button>
                                                </Magnetic>
                                            </div>
                                            {isDeadlinePassed ? (
                                                <p className="text-base font-mono text-red-400 uppercase tracking-widest">
                                                    We are not accepting applications anymore
                                                </p>
                                            ) : (
                                                <p className="text-base font-mono text-nation-secondary uppercase tracking-widest animate-pulse">
                                                    The Induction registration date is extended to 9th Feb
                                                </p>
                                            )}
                                        </div>
                                    );
                                }

                                if (registrationActive && !inductionActive) {
                                    return (
                                        <Magnetic>
                                            <button
                                                onClick={handleRegister}
                                                className="w-full sm:w-auto px-5 sm:px-8 py-2.5 sm:py-4 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant shadow-lg"
                                            >
                                                Register
                                            </button>
                                        </Magnetic>
                                    );
                                }

                                // Default: show both
                                return (
                                    <>
                                        <Magnetic>
                                            <button
                                                onClick={handleRegister}
                                                className="w-full sm:w-auto px-5 sm:px-8 py-2.5 sm:py-4 bg-nation-secondary text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs hover:bg-white hover:text-black transition-all duration-300 clip-path-slant shadow-lg"
                                            >
                                                Register
                                            </button>
                                        </Magnetic>
                                        <Magnetic>
                                            <button
                                                onClick={handleJoinCorps}
                                                className="w-full sm:w-auto px-5 sm:px-8 py-2.5 sm:py-4 bg-transparent border border-white/20 text-white font-display font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-xs hover:border-nation-secondary hover:text-nation-secondary transition-all duration-300 relative backdrop-blur-sm"
                                            >
                                                Induction
                                                <HudCorner position="tl" />
                                                <HudCorner position="br" />
                                            </button>
                                        </Magnetic>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </motion.div>

                    <div className="absolute bottom-12 w-full flex justify-center items-center gap-2 opacity-50 animate-bounce pointer-events-none">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-nation-text">System Ready</span>
                        <ArrowDown size={14} className="text-nation-secondary" />
                    </div>
                </section>

                {/* MISSION BRIEF - Mobile: Reduced padding */}
                <section id="mission" className="py-12 sm:py-20 md:py-24 relative overflow-hidden bg-nation-void">
                    {/* Top gradient for seamless transition from hero */}
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-nation-void to-transparent pointer-events-none"></div>
                    <ParallaxBackground text="MISSION" direction={-1} />
                    <div className="container mx-auto px-4 sm:px-6 relative z-10">
                        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ margin: "-100px" }}
                                transition={{ duration: 0.8 }}
                            >
                                <SectionTitle subtitle="Manifesto">Mission Brief</SectionTitle>
                                <p className="text-base leading-relaxed text-nation-text mb-6 font-light">
                                    Udaan is the premier aeromodelling club of <strong className="text-white">NIT Rourkela</strong>. We bridge the gap between theoretical aerodynamics and practical engineering through rigorous design cycles.
                                    <br /><br />
                                    Our vision is to empower students with hands-on experience in aerospace technologies, fostering a community of innovators who are ready to tackle the challenges of modern aviation and autonomous systems.
                                </p>
                                <p className="text-sm leading-relaxed text-nation-text/80 mb-8 font-light border-l border-white/10 pl-4">
                                    Founded with the vision to conquer the skies, we foster a culture of innovation where students design, build, and fly sophisticated aerial vehicles. From autonomous drones mapping terrain to sounding rockets piercing the atmosphere, Udaan is the training ground for the next generation of aerospace engineers.
                                </p>

                                <div className="mt-10 grid gap-3">
                                    <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2">Directives</h3>

                                    {/* Drone Directive */}
                                    <div className="flex items-center gap-4 p-4 bg-nation-panel/40 border-l border-white/20 rounded-r-lg hover:border-nation-secondary transform hover:-translate-y-1 transition-all duration-300 cursor-default group">
                                        <Hexagon size={18} className="text-white group-hover:text-nation-secondary transition-colors" />
                                        <div>
                                            <span className="block text-[9px] font-mono uppercase tracking-widest text-white group-hover:text-nation-secondary transition-colors">Drone</span>
                                            <span className="text-sm font-display text-white uppercase group-hover:text-nation-secondary transition-colors">"Autonomous Precision"</span>
                                        </div>
                                    </div>

                                    {/* Rocketry Directive */}
                                    <div className="flex items-center gap-4 p-4 bg-nation-panel/40 border-l border-white/20 rounded-r-lg hover:border-nation-secondary transform hover:-translate-y-1 transition-all duration-300 cursor-default group">
                                        <Rocket size={18} className="text-white group-hover:text-nation-secondary transition-colors" />
                                        <div>
                                            <span className="block text-[9px] font-mono uppercase tracking-widest text-white group-hover:text-nation-secondary transition-colors">Rocketry</span>
                                            <span className="text-sm font-display text-white uppercase group-hover:text-nation-secondary transition-colors">"Breaking Boundaries"</span>
                                        </div>
                                    </div>

                                    {/* RC Plane Directive */}
                                    <div className="flex items-center gap-4 p-4 bg-nation-panel/40 border-l border-white/20 rounded-r-lg hover:border-nation-secondary transform hover:-translate-y-1 transition-all duration-300 cursor-default group">
                                        <Plane size={18} className="text-white group-hover:text-nation-secondary transition-colors" />
                                        <div>
                                            <span className="block text-[9px] font-mono uppercase tracking-widest text-white group-hover:text-nation-secondary transition-colors">RC Plane</span>
                                            <span className="text-sm font-display text-white uppercase group-hover:text-nation-secondary transition-colors">"Mastering Flight"</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                            <div className="relative h-[400px] w-full rounded-lg overflow-hidden border border-white/5 bg-black/40">
                                <CombatJetScene />
                                <div className="absolute inset-0 pointer-events-none">
                                    <HudCorner position="tl" />
                                    <HudCorner position="tr" />
                                    <HudCorner position="bl" />
                                    <HudCorner position="br" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FLEET - Mobile: Reduced padding */}
                <section id="fleet" className="py-12 sm:py-20 md:py-24 bg-void-gradient relative overflow-hidden">
                    <ParallaxBackground text="FLEET" direction={1} />
                    <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                    <div className="container mx-auto px-4 sm:px-6 relative z-10">
                        <SectionTitle subtitle="Fleet">Active Divisions</SectionTitle>
                        <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                            Our technical divisions specialize in distinct aerospace domains. From rotary-wing stability to high-altitude ballistics, each team pushes the envelope of what is possible with student-built aircraft.
                        </p>

                        {/* Mobile: Reduced gap between cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
                            {/* Drone */}
                            <div
                                className="group relative bg-nation-panel/60 border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg overflow-hidden flex flex-col"
                            >
                                <div className="h-48 lg:h-64 bg-black/50 relative overflow-hidden border-b border-white/5">
                                    <QuadRotorStatus />
                                </div>
                                <div className="p-4 lg:p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 lg:gap-3 mb-3 lg:mb-4">
                                        <Hexagon className="text-nation-secondary" size={18} />
                                        <h3 className="font-display text-lg lg:text-xl text-white uppercase">Drone</h3>
                                    </div>
                                    <p className="text-nation-text text-[11px] lg:text-xs leading-relaxed mb-4 lg:mb-6 border-b border-white/5 pb-3 lg:pb-4">
                                        Engineering advanced rotary-wing platforms for precision racing, autonomous mapping, and payload delivery missions. Our fleet utilizes custom PID tuning and sensor fusion for stability in adverse conditions.
                                    </p>
                                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mt-auto">
                                        <LiveMetric label="BATT" value={14.8} unit="V" icon={Battery} />
                                        <LiveMetric label="LINK" value={98} unit="%" icon={Signal} />
                                        <LiveMetric label="GPS" value={12} unit="SAT" icon={Globe} />
                                    </div>
                                </div>
                            </div>

                            {/* RC Plane */}
                            <div
                                className="group relative bg-nation-panel/60 border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg overflow-hidden flex flex-col"
                            >
                                <div className="h-48 lg:h-64 bg-black/50 relative overflow-hidden border-b border-white/5">
                                    <AeroFlow />
                                </div>
                                <div className="p-4 lg:p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 lg:gap-3 mb-3 lg:mb-4">
                                        <Plane className="text-nation-secondary" size={18} />
                                        <h3 className="font-display text-lg lg:text-xl text-white uppercase">RC Plane</h3>
                                    </div>
                                    <p className="text-nation-text text-[11px] lg:text-xs leading-relaxed mb-4 lg:mb-6 border-b border-white/5 pb-3 lg:pb-4">
                                        Developing high-performance fixed-wing aircraft optimized for endurance, speed, and complex aerobatic maneuvers. We experiment with airfoil designs, composite materials, and thrust-vectoring systems.
                                    </p>
                                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mt-auto">
                                        <LiveMetric label="IAS" value={24} unit="m/s" icon={Wind} />
                                        <LiveMetric label="THR" value={65} unit="%" icon={Zap} />
                                        <LiveMetric label="L/D" value={14.2} unit="" icon={Activity} />
                                    </div>
                                </div>
                            </div>

                            {/* Rocket */}
                            <div
                                className="group relative bg-nation-panel/60 border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg overflow-hidden flex flex-col"
                            >
                                <div className="h-48 lg:h-64 bg-black/50 relative overflow-hidden border-b border-white/5">
                                    <RocketTrajectory />
                                </div>
                                <div className="p-4 lg:p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 lg:gap-3 mb-3 lg:mb-4">
                                        <Rocket className="text-nation-secondary" size={18} />
                                        <h3 className="font-display text-lg lg:text-xl text-white uppercase">Rocketry</h3>
                                    </div>
                                    <p className="text-nation-text text-[11px] lg:text-xs leading-relaxed mb-4 lg:mb-6 border-b border-white/5 pb-3 lg:pb-4">
                                        Design and fabrication of high-powered sounding rockets with custom propulsion and dual-deployment recovery systems. Our research focuses on variable-thrust solid motors and active stabilization algorithms.
                                    </p>
                                    <div className="grid grid-cols-3 gap-1.5 lg:gap-2 mt-auto">
                                        <LiveMetric label="INC" value={88.4} unit="deg" icon={Target} />
                                        <LiveMetric label="WIND" value={4.2} unit="m/s" icon={Wind} />
                                        <LiveMetric label="PRS" value={1013} unit="hPa" icon={Gauge} />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Ground Support */}
                        <div className="mt-10 lg:mt-16">
                            <h3 className="font-mono text-[9px] lg:text-[10px] uppercase tracking-[0.2em] lg:tracking-[0.3em] text-nation-text/60 mb-5 lg:mb-8 flex items-center gap-3 lg:gap-4">
                                <span className="w-6 lg:w-8 h-[1px] bg-white/10"></span>Ground Support
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                                {/* Creative & Web */}
                                <div className="group flex items-center gap-4 lg:gap-6 p-4 lg:p-6 bg-nation-panel/60 backdrop-blur-sm border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg hover:bg-nation-panel/80">
                                    <div className="w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center border border-white/10 rounded-lg text-white/80 bg-black group-hover:text-nation-secondary group-hover:border-nation-secondary/50 transition-all shadow-lg">
                                        <Palette size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-display text-base lg:text-lg text-white uppercase tracking-widest mb-1 group-hover:text-nation-secondary transition-colors">Creative & Web</h4>
                                        <p className="text-nation-text text-[11px] lg:text-xs leading-relaxed">Design, branding, social media, and web development. Crafting the visual identity and digital presence of UDAAN.</p>
                                    </div>
                                </div>
                                {/* Management */}
                                <div className="group flex items-center gap-4 lg:gap-6 p-4 lg:p-6 bg-nation-panel/60 backdrop-blur-sm border border-white/5 hover:border-nation-secondary/50 transition-all duration-500 rounded-lg hover:bg-nation-panel/80">
                                    <div className="w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center border border-white/10 rounded-lg text-white/80 bg-black group-hover:text-nation-secondary group-hover:border-nation-secondary/50 transition-all shadow-lg">
                                        <Briefcase size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-display text-base lg:text-lg text-white uppercase tracking-widest mb-1 group-hover:text-nation-secondary transition-colors">Management</h4>
                                        <p className="text-nation-text text-[11px] lg:text-xs leading-relaxed">Event coordination, logistics, sponsorships, and operations. The backbone that keeps UDAAN running smoothly.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* TELEMETRY - Mobile: Reduced padding */}
                <section id="telemetry" className="py-12 sm:py-20 md:py-24 relative overflow-hidden bg-nation-black">
                    <ParallaxBackground text="DATA" direction={-1} />
                    <div className="container mx-auto px-4 sm:px-6 relative z-10">
                        <SectionTitle subtitle="Telemetry">System Data</SectionTitle>
                        <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                            Real-time Flight Analysis. Our systems capture high-frequency data from onboard flight computers, analyzing propulsion efficiency, aerodynamic stability, and trajectory prediction models to optimize mission performance during live deployments.
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-10 lg:mb-16">
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ margin: "-50px" }} transition={{ duration: 0.8 }} className="h-full">
                                <SubsystemPipeline />
                            </motion.div>
                            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ margin: "-50px" }} transition={{ delay: 0.2, duration: 0.8 }} className="h-full">
                                <PropulsionMetrics />
                            </motion.div>
                        </div>

                        {/* Current Projects - Mobile: Reduced spacing */}
                        <div className="mt-10 lg:mt-16">
                            <h3 className="font-mono text-[9px] lg:text-[10px] uppercase tracking-[0.2em] lg:tracking-[0.3em] text-nation-text/60 mb-5 lg:mb-8 flex items-center gap-3 lg:gap-4">
                                <span className="w-6 lg:w-8 h-[1px] bg-white/10"></span>Current Projects
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
                                {[
                                    { title: 'Autonomous Drone', icon: Hexagon, desc: 'AI-powered navigation and obstacle avoidance systems' },
                                    { title: 'Sounding Rocket', icon: Rocket, desc: 'High-altitude research rocket with custom propulsion' },
                                    { title: 'RC Aircraft', icon: Plane, desc: 'Competition-grade fixed-wing aircraft design' },
                                    { title: 'FPV Systems', icon: Signal, desc: 'Real-time video transmission and control systems' }
                                ].map((project, i) => (
                                    <div
                                        key={i}
                                        className="group relative bg-nation-panel/60 border border-white/5 hover:border-nation-secondary/50 rounded-lg overflow-hidden transition-all duration-500"
                                    >
                                        <div className="aspect-video bg-gradient-to-br from-nation-panel to-nation-void flex items-center justify-center">
                                            <div className="text-center">
                                                <project.icon size={28} className="mx-auto mb-1.5 lg:mb-2 text-nation-secondary group-hover:scale-110 transition-transform" />
                                                <p className="text-white/30 text-[10px] lg:text-xs">Project Photo</p>
                                            </div>
                                        </div>
                                        <div className="p-3 lg:p-4">
                                            <h4 className="font-display text-white uppercase text-xs lg:text-sm mb-1 lg:mb-2">{project.title}</h4>
                                            <p className="text-nation-text text-[10px] lg:text-xs">{project.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* EVENTS - Mobile: Reduced padding */}
                <section id="events" className="py-12 sm:py-20 md:py-24 bg-void-gradient relative border-t border-white/5 overflow-hidden">
                    <ParallaxBackground text="EVENTS" direction={1} />
                    <div className="container mx-auto px-4 sm:px-6 relative z-10">
                        <SectionTitle subtitle="Deployments">Our Events</SectionTitle>
                        <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                            As the technical society's flagship aeromodelling entity, we host Eastern India's largest aviation competitions. Test your piloting skills, engineering acumen, and strategic thinking in our signature events designed to push the boundaries of collegiate aeromodelling.
                        </p>
                        {/* Mobile: Reduced gap between event cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
                            <PosterCard
                                title="Aeroprix"
                                subtitle="RC Plane Battle"
                                date="Nov 8th, Sat"
                                venue="STS Grounds"
                                prize="15K Pool"
                                imgSrc="https://images.unsplash.com/photo-1559627784-ca429e47f5b1?q=80&w=1000&auto=format&fit=crop"
                                delay={0}
                                eventId="aeroprix"
                                onRegister={handleRegister}
                                isTeamMember={isTeamMember}
                                registrationCount={registrationCounts['aeroprix'] || 0}
                                onDetails={() => handleViewEventDetails('aeroprix')}
                                registrationOpen={registrationOpen}
                            />
                            <PosterCard
                                title="Hovermania"
                                subtitle="Hovercraft Battle"
                                date="Nov 9th, Sun"
                                venue="LA Lawns"
                                prize="8K Pool"
                                imgSrc="https://images.unsplash.com/photo-1541363111435-5c1b7d867904?q=80&w=1000&auto=format&fit=crop"
                                colorClass="text-nation-secondary"
                                delay={0.2}
                                eventId="hovermania"
                                onRegister={handleRegister}
                                isTeamMember={isTeamMember}
                                registrationCount={registrationCounts['hovermania'] || 0}
                                onDetails={() => handleViewEventDetails('hovermania')}
                                registrationOpen={registrationOpen}
                            />
                            <PosterCard
                                title="Aviation Sim"
                                subtitle="Pilot Experience"
                                date="Nov 9th, Sun"
                                venue="LA Lawns"
                                imgSrc="https://images.unsplash.com/photo-1551103782-8ab07afd45c1?q=80&w=1000&auto=format&fit=crop"
                                colorClass="text-nation-secondary"
                                delay={0.4}
                                eventId="aviation-sim"
                                onRegister={handleRegister}
                                isTeamMember={isTeamMember}
                                registrationCount={registrationCounts['aviation-sim'] || 0}
                                onDetails={() => handleViewEventDetails('aviation-sim')}
                                registrationOpen={registrationOpen}
                            />
                        </div>
                    </div>
                </section>

                {/* Event Details Modal */}
                {selectedEvent && (
                    <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
                )}

                {/* ACHIEVEMENTS SECTION - Auto-scrolling horizontal showcase */}
                <AchievementsSection />

                {/* COUNCIL SECTION - Dynamic, fetches from database */}
                {/* Photos sync with profile photos, Secretary displayed as tag */}
                {/* Role-based slot mapping ensures fixed layout */}
                <CouncilSection />

                {/* OUR TEAM - Mobile: Reduced padding */}
                {/* OUR TEAM - Mobile: Reduced padding */}
                {false && (
                    <section id="team" className="py-12 sm:py-20 md:py-24 relative overflow-hidden bg-nation-void">
                        <ParallaxBackground text="TEAM" direction={1} />
                        <div className="container mx-auto px-4 sm:px-6 relative z-10">
                            <SectionTitle subtitle="The Crew">Our Team</SectionTitle>
                            <p className="text-nation-text max-w-2xl mb-8 lg:mb-12 text-xs sm:text-sm leading-relaxed">
                                Meet the passionate individuals who make Udaan soar. Our diverse team of engineers, designers, and aviation enthusiasts work together to push the boundaries of student-led aerospace innovation.
                            </p>

                            {/* Member Portal Button removed per request */}

                            {/* Team Photo */}
                            <div
                                className="relative rounded-xl overflow-hidden border border-white/10 bg-nation-panel/40"
                            >
                                <div className="aspect-[21/9] bg-gradient-to-br from-nation-panel to-nation-void flex items-center justify-center relative">
                                    <div className="text-center">
                                        <div className="w-24 h-24 mx-auto mb-4 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                                            <Crown size={32} className="text-nation-secondary" />
                                        </div>
                                        <p className="text-nation-text font-mono text-sm uppercase tracking-widest">Team Photo</p>
                                        <p className="text-white/30 text-xs mt-2">Add your team image here</p>
                                    </div>
                                    <HudCorner position="tl" />
                                    <HudCorner position="tr" />
                                    <HudCorner position="bl" />
                                    <HudCorner position="br" />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* FOOTER - Mobile: Reduced padding */}
                <footer className="bg-nation-black border-t border-white/5 pt-10 lg:pt-16 pb-20 lg:pb-24 relative z-20">
                    <div className="container mx-auto px-4 lg:px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-12 mb-8 lg:mb-12">
                            <div className="col-span-2">
                                <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
                                    <div className="w-10 h-10 lg:w-12 lg:h-12">
                                        <img src="/udaan-logo.webp" alt="Udaan" className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                                    </div>
                                    <div>
                                        <h2 className="font-display text-lg lg:text-xl text-white uppercase tracking-widest font-bold">UDAAN</h2>
                                        <p className="text-[8px] lg:text-[9px] font-mono text-nation-text uppercase tracking-[0.2em] lg:tracking-[0.3em]">NIT Rourkela</p>
                                    </div>
                                </div>
                                <p className="text-nation-text text-xs lg:text-sm font-mono leading-relaxed max-w-sm mb-4 lg:mb-6 opacity-70">
                                    Technical Society, Student Activity Centre.<br />
                                    National Institute of Technology, Rourkela.<br />
                                    Odisha, India - 769008.
                                </p>
                                <div className="flex gap-3 lg:gap-4">
                                    <a href="#" className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center border border-white/10 text-nation-text hover:text-white hover:border-white transition-all rounded-full"><Instagram size={12} className="lg:w-3.5 lg:h-3.5" /></a>
                                    <a href="#" className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full"><Linkedin size={12} className="lg:w-3.5 lg:h-3.5" /></a>
                                    <a href="#" className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center border border-white/10 text-nation-text hover:text-nation-secondary hover:border-nation-secondary transition-all rounded-full"><Globe size={12} className="lg:w-3.5 lg:h-3.5" /></a>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-white font-display uppercase tracking-widest mb-4 lg:mb-6 text-xs lg:text-sm font-bold">Command</h3>
                                <ul className="space-y-2 lg:space-y-3 text-[10px] lg:text-xs font-mono text-nation-text uppercase tracking-wider">
                                    <li><button onClick={() => scrollToSection('mission')} className="hover:text-nation-secondary transition-colors">Mission</button></li>
                                    <li><button onClick={() => scrollToSection('fleet')} className="hover:text-nation-secondary transition-colors">Fleet</button></li>
                                    <li><button onClick={() => scrollToSection('events')} className="hover:text-nation-secondary transition-colors">Events</button></li>
                                    <li><button onClick={() => scrollToSection('squadron')} className="hover:text-nation-secondary transition-colors">Council</button></li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-white font-display uppercase tracking-widest mb-4 lg:mb-6 text-xs lg:text-sm font-bold">Channels</h3>
                                <ul className="space-y-2 lg:space-y-3 text-[10px] lg:text-xs font-mono text-nation-text uppercase tracking-wider">
                                    <li className="flex items-center gap-1.5 lg:gap-2"><Phone size={10} className="text-nation-secondary lg:w-3 lg:h-3" /><span>Deepan: +91 98941 29722</span></li>
                                    <li className="flex items-center gap-1.5 lg:gap-2"><Phone size={10} className="text-nation-secondary lg:w-3 lg:h-3" /><span>Nirav: +91 93138 12785</span></li>
                                </ul>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-6 lg:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 lg:gap-4">
                            <p className="text-[9px] lg:text-[10px] font-mono text-nation-text/50 uppercase tracking-widest">© {new Date().getFullYear()} Udaan. NIT Rourkela.</p>
                            <p className="text-[9px] lg:text-[10px] font-mono text-nation-text/50 uppercase tracking-widest">System Status: <span className="text-nation-secondary">Online</span></p>
                        </div>

                        {/* Website Credit */}
                        <div className="border-t border-white/5 mt-4 lg:mt-6 pt-3 lg:pt-4 text-center">
                            <p className="text-[9px] lg:text-[10px] font-mono text-nation-text/50 tracking-wider">
                                Website made by: <span className="text-nation-secondary">Nirav Sayanja</span> (Secretary & Creative Head)
                            </p>
                        </div>

                        {/* Music Attribution */}
                        <div className="border-t border-white/5 mt-3 lg:mt-4 pt-3 lg:pt-4 text-center">
                            <p className="text-[8px] lg:text-[9px] font-mono text-nation-text/40 tracking-wider">
                                <Music size={10} className="inline mr-1 mb-0.5" />
                                Background Music: "Surrounded" by Hayden Folker
                                <span className="mx-1.5 lg:mx-2">|</span>
                                <a href="https://www.bensound.com/royalty-free-music" target="_blank" rel="noopener noreferrer" className="text-nation-text/60 hover:text-nation-secondary transition-colors">Bensound.com</a>
                            </p>
                        </div>
                    </div>
                </footer>
            </div >
        </>
    );
};

const App = () => (
    <AudioProvider>
        <Routes>
            <Route path="/" element={<MainContent />} />
            <Route path="/join-corps" element={<JoinCorpsPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/team-login" element={<TeamLoginPage />} />
            <Route path="/induction-portal" element={<TeamLoginPage />} />
            <Route path="/induction-login" element={<InductionLoginPage />} />
        </Routes>
    </AudioProvider>
);

export default App;
