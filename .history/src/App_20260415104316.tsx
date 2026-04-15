/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import { submitEntry } from './lib/appwrite';

const FloatingCard = ({ children, className, style, delay = 0 }: any) => {
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(floatRef.current, {
        y: -20,
        rotation: style.rotate + 5,
        duration: 3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: delay,
      });
    });
    return () => ctx.revert();
  }, [style.rotate, delay]);

  return (
    <div className={`absolute z-0 hover:z-50 pointer-events-auto ${className}`}>
      <div ref={floatRef} className="w-full h-full" style={{ transform: `rotate(${style.rotate}deg)` }}>
        <motion.div
          className="w-full h-full rounded-2xl shadow-xl border border-zinc-100/50 bg-white/80 backdrop-blur-sm p-2 cursor-pointer group"
          whileHover={{
            scale: 1.15,
            boxShadow: "0 25px 50px -12px rgba(249, 115, 22, 0.3)",
            borderColor: "rgba(249, 115, 22, 0.5)",
            transition: { type: "spring", stiffness: 300, damping: 15 }
          }}
          whileTap={{ 
            scale: 0.9, 
            transition: { type: "spring", stiffness: 300, damping: 15 } 
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};

const FloatingCards = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Top Left */}
      <FloatingCard className="w-32 h-24 md:w-48 md:h-32 left-[-2%] md:left-[4%] top-[5%] md:top-[8%]" style={{ rotate: -12 }} delay={0}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-2/3 h-2/3 text-orange-500 group-hover:scale-125 transition-transform duration-500 ease-out">
            <ellipse cx="50" cy="30" rx="40" ry="20" fill="none" stroke="currentColor" strokeWidth="4"/>
            <circle cx="50" cy="30" r="12" fill="currentColor"/>
          </svg>
        </div>
      </FloatingCard>

      {/* Top Right */}
      <FloatingCard className="w-28 h-20 md:w-40 md:h-28 right-[-2%] md:right-[4%] top-[8%] md:top-[12%]" style={{ rotate: 15 }} delay={1}>
        <div className="w-full h-full bg-zinc-900 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-2/3 h-2/3 group-hover:-translate-y-2 group-hover:scale-110 transition-transform duration-500 ease-out">
            <path d="M10,30 Q30,10 50,30 T90,30" fill="none" stroke="#f97316" strokeWidth="4"/>
            <circle cx="10" cy="30" r="6" fill="#f97316"/>
            <circle cx="50" cy="30" r="6" fill="#f97316"/>
            <circle cx="90" cy="30" r="6" fill="#f97316"/>
          </svg>
        </div>
      </FloatingCard>

      {/* Bottom Left */}
      <FloatingCard className="w-36 h-24 md:w-52 md:h-36 left-[2%] md:left-[6%] bottom-[10%] md:bottom-[12%]" style={{ rotate: 8 }} delay={0.5}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden relative">
           <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out"></div>
           <div className="absolute -right-4 -top-4 w-20 h-20 bg-zinc-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out delay-75"></div>
           <div className="w-16 h-16 bg-zinc-900 rounded-full z-10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-180 transition-all duration-500 ease-out">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
           </div>
        </div>
      </FloatingCard>

      {/* Bottom Right */}
      <FloatingCard className="w-32 h-24 md:w-48 md:h-32 right-[2%] md:right-[5%] bottom-[5%] md:bottom-[10%]" style={{ rotate: -6 }} delay={1.5}>
        <div className="w-full h-full bg-orange-500 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
           <svg viewBox="0 0 100 100" className="w-1/2 h-1/2 text-white group-hover:rotate-[120deg] group-hover:scale-110 transition-all duration-700 ease-out">
              <polygon points="50,10 90,90 10,90" fill="currentColor"/>
              <circle cx="50" cy="65" r="12" fill="#f97316"/>
           </svg>
        </div>
      </FloatingCard>
      
      {/* Center Left (small) */}
      <FloatingCard className="w-20 h-20 md:w-28 md:h-28 left-[-5%] md:left-[2%] top-[45%] hidden sm:block" style={{ rotate: -25 }} delay={2}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
           <div className="w-10 h-10 border-4 border-zinc-900 rounded-sm rotate-12 group-hover:rotate-[135deg] group-hover:scale-125 group-hover:border-orange-500 transition-all duration-500 ease-out"></div>
        </div>
      </FloatingCard>

      {/* Center Right (small) */}
      <FloatingCard className="w-24 h-16 md:w-36 md:h-24 right-[-5%] md:right-[2%] top-[50%] hidden sm:block" style={{ rotate: 20 }} delay={0.8}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
           <div className="w-full h-3 bg-zinc-100 mx-6 rounded-full relative overflow-hidden group-hover:h-6 transition-all duration-300 ease-out">
              <motion.div 
                className="absolute left-0 top-0 h-full bg-orange-500 rounded-full"
                animate={{ width: ['20%', '80%', '20%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
           </div>
        </div>
      </FloatingCard>
    </div>
  );
};

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    setTimeout(() => {
      setStep(3);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-zinc-100">
          <h3 className="text-xl font-bold text-zinc-900">提交参赛作品</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">姓名</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" placeholder="请输入真实姓名" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">联系电话</label>
                  <input required type="tel" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" placeholder="请输入手机号码" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">所在学校</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" placeholder="请输入学校全称" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">学号</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" placeholder="请输入学号" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">参赛类别</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input type="radio" name="category" value="postcard" className="sr-only" defaultChecked />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">明信片设计</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">图片格式 (JPG/PNG)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input type="radio" name="category" value="presentation" className="sr-only" />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">演示文稿演讲</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">文档格式 (PPT/PDF)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input type="radio" name="category" value="video" className="sr-only" />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">项目上传视频</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">200MB内ZIP打包</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">作品上传</label>
                <div className="mt-2 flex justify-center rounded-xl border-2 border-dashed border-zinc-200 px-6 py-12 hover:border-orange-400 hover:bg-orange-50/30 transition-all relative group bg-zinc-50/50">
                  <div className="text-center">
                    <div className="w-16 h-16 mb-4 mx-auto bg-white rounded-full shadow-sm flex items-center justify-center border border-zinc-100 group-hover:scale-110 transition-transform">
                      <Upload className="h-8 w-8 text-zinc-400 group-hover:text-orange-500 transition-colors" aria-hidden="true" />
                    </div>
                    <div className="flex text-sm leading-6 text-zinc-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-bold text-orange-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-600 focus-within:ring-offset-2">
                        <span>点击选择文件</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="pl-1">或拖拽至此区域</p>
                    </div>
                    <p className="text-xs leading-5 text-zinc-400 mt-2">支持 ZIP, RAR, PDF, PPT, JPG (视频请打包成200MB以内的ZIP)</p>
                    {file && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-white border border-orange-200 text-orange-700 text-sm font-medium shadow-sm"
                      >
                        <span className="truncate max-w-[200px]">{file.name}</span>
                        <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} className="ml-2 text-orange-400 hover:text-orange-600">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end gap-4">
                <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">
                  取消
                </button>
                <button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0">
                  确认提交
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="py-32 flex flex-col items-center justify-center space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-orange-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-lg font-bold text-zinc-700 animate-pulse">正在加密上传您的作品...</p>
            </div>
          )}

          {step === 3 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              >
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
              </motion.div>
              <div className="space-y-3">
                <h4 className="text-3xl font-black text-zinc-900">提交成功！</h4>
                <p className="text-zinc-500 max-w-sm mx-auto">您的作品已成功上传至大赛组委会，请保持通讯畅通，祝您取得好成绩。</p>
              </div>
              <button onClick={onClose} className="mt-8 px-10 py-4 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all hover:-translate-y-0.5 shadow-xl shadow-zinc-900/20">
                返回首页
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 overflow-hidden relative font-sans selection:bg-orange-200 flex flex-col">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 md:p-10">
        <div className="text-sm md:text-base font-bold tracking-tight text-zinc-800 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          上海市民办高校新联会
        </div>
        <div className="text-sm md:text-base font-bold tracking-tight text-zinc-400">
          2026
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-0">
        
        <FloatingCards />

        {/* Center Text */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center z-20 max-w-4xl mx-auto w-full relative"
        >
          {/* Protective glow to ensure text readability against floating cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[160%] bg-white/90 blur-3xl rounded-full pointer-events-none -z-10"></div>

          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-zinc-200 bg-white/50 backdrop-blur-sm text-sm font-bold text-zinc-500 tracking-widest uppercase shadow-sm">
            第三届大学生
          </div>
          
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-black tracking-tight mb-6 text-zinc-900 flex flex-row items-center justify-center gap-4 sm:gap-8 drop-shadow-sm flex-wrap">
            <span>设计</span>
            <span className="text-orange-500 font-serif italic font-light text-5xl sm:text-7xl md:text-8xl lg:text-[8rem]">&</span>
            <span>演讲</span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-3xl font-medium text-zinc-500 mb-12 tracking-wide">
            明信片设计及演示文稿演讲大赛
          </p>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="group relative inline-flex items-center justify-center px-10 py-5 text-lg md:text-xl font-black text-white transition-all duration-300 bg-orange-600 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-600 hover:bg-orange-700 shadow-2xl shadow-orange-600/30 overflow-hidden"
          >
            <span className="relative z-10 flex items-center">
              作品申报入口
              <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
          </motion.button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end p-6 md:p-10 mt-auto text-xs md:text-sm text-zinc-400 gap-6 text-center md:text-left bg-gradient-to-t from-white/80 to-transparent pt-20">
        <div className="max-w-2xl space-y-2">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">组织架构</p>
          <p><span className="font-semibold text-zinc-500">主办单位：</span>上海市民办高校新的社会阶层人士联谊会</p>
          <p><span className="font-semibold text-zinc-500">承办单位：</span>上海震旦职业学院、上海外国语大学贤达经济人文学院、上海建桥学院、上海师范大学天华学院</p>
        </div>
        <div className="md:text-right space-y-2">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">活动时间</p>
          <p className="font-mono text-zinc-500 bg-zinc-100 px-3 py-1 rounded-md inline-block">2026.4.20 - 2026.5.15</p>
        </div>
      </footer>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <SubmitModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
