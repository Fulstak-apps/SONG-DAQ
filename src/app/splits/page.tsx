"use client";
import Link from "next/link";
import { ChevronLeft, Info, CheckCircle2, AlertCircle, ArrowRight, Copy, Globe, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function SplitsPage() {
  const [copied, setCopied] = useState(false);
  const vaultEmail = "your-token-name@songdaq.io";

  const copy = () => {
    navigator.clipboard.writeText(vaultEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-12 px-6 fade-in relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-violet/10 to-transparent pointer-events-none blur-[120px]" />
      
      <Link href="/" className="group inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white transition-all relative z-10">
        <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Return to Terminal
      </Link>

      <div className="space-y-4 relative z-10 text-center">
        <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl">
          Royalty Verification <span className="text-violet">Protocol</span>
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto font-medium">
          Automate your revenue distribution and unlock the institutional trust badge for your asset.
        </p>
      </div>

      <div className="panel p-8 space-y-6 relative overflow-hidden shadow-2xl border border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex items-start gap-5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-violet/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(155,81,224,0.3)]">
            <Info className="text-violet" size={24} />
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">Your Unique Settlement Identity</h2>
              <p className="text-sm text-white/50 font-medium">
                Every SONGDAQ asset is assigned a dedicated secure vault. Route your splits to this identity to bridge off-chain revenue to your on-chain holders.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <div className="flex-1 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-neon flex items-center justify-between shadow-inner group">
                <span className="truncate">{vaultEmail}</span>
                <button onClick={copy} className="ml-4 text-white/30 hover:text-white transition-colors p-1">
                  {copied ? <CheckCircle2 size={16} className="text-neon" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/20 whitespace-nowrap">
                {copied ? "ID Copied to Clipboard" : "Copy to Distributor Settings"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <h2 className="text-[10px] uppercase tracking-widest font-black text-white/30">Integration Procedures</h2>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <ProcedureCard 
            id="DK" 
            name="DistroKid" 
            color="bg-black" 
            steps={[
              { title: "Navigate to Splits", desc: "Select 'Splits' from the primary navigation menu." },
              { title: "Select Asset", desc: "Choose the release associated with your SONGDAQ token." },
              { title: "Deploy Collaborator", desc: "Select 'Add Collaborator' and enter your Vault Identity above." },
              { title: "Calibrate Allocation", desc: "Assign the specific percentage (min. 10%) as committed in your launch." },
              { title: "Finalize Verification", desc: "Save changes. Verification status will sync within 24-48 hours." }
            ]}
          />

          <ProcedureCard 
            id="TC" 
            name="TuneCore" 
            color="bg-blue-600" 
            steps={[
              { title: "Access Analytics", desc: "Enter 'Money & Analytics' → 'Splits' in your dashboard." },
              { title: "Initialize Split", desc: "Locate your track and select 'Edit Splits'." },
              { title: "Register Payee", desc: "Create a new payee using your unique vault email identity." },
              { title: "Assign Share", desc: "Input the committed royalty percentage and confirm." }
            ]}
          />

          <ProcedureCard 
            id="UM" 
            name="UnitedMasters" 
            color="bg-white text-black" 
            steps={[
              { title: "Open Release Tools", desc: "Locate your release in the dashboard or UnitedMasters app." },
              { title: "Route Royalties", desc: "Select 'Split Royalties' from the management view." },
              { title: "Invite Settlement Vault", desc: "Invite a new collaborator using your vault identity." },
              { title: "Sync Protocol", desc: "Set the percentage. SONGDAQ protocol will auto-accept the invitation." }
            ]}
          />
        </div>
      </div>

      <div className="panel p-8 bg-red/5 border border-red/20 rounded-2xl flex items-start gap-5 shadow-xl relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-red/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,51,102,0.2)]">
          <AlertCircle className="text-red" size={24} />
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-red tracking-tight uppercase">Critical Compliance Rules</h3>
            <p className="text-sm text-red/60 font-medium">Failure to adhere to these protocols may result in asset delisting.</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <RuleItem text="Minimum 10% master royalty commitment is mandatory." />
            <RuleItem text="Split removal triggers immediate 'High Risk' terminal flags." />
            <RuleItem text="Monthly settlement is automated via the Solana network." />
            <RuleItem text="Vault identities are cryptographically unique per asset." />
          </ul>
        </div>
      </div>

      <footer className="text-center pt-8 relative z-10">
        <p className="text-[10px] uppercase tracking-widest font-bold text-white/20">
          Need assistance with a different distributor? <a href="mailto:support@songdaq.io" className="text-violet hover:text-white transition-colors ml-1">Contact Protocol Support</a>
        </p>
      </footer>
    </div>
  );
}

function ProcedureCard({ id, name, color, steps }: { id: string; name: string; color: string; steps: { title: string; desc: string }[] }) {
  return (
    <div className="panel p-0 overflow-hidden shadow-xl hover:shadow-2xl transition-all border border-white/5 bg-black/40 group">
      <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-black/20">
        <h3 className="font-black text-xl tracking-tighter flex items-center gap-4 text-white group-hover:text-neon transition">
          <span className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-[10px] font-black border border-white/10 shadow-lg`}>{id}</span>
          {name}
        </h3>
        <div className="text-[10px] uppercase tracking-widest font-bold text-white/30 group-hover:text-white/50 transition">Standard Integration</div>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <div key={i} className="space-y-2 relative">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold text-violet bg-violet/10 px-2 py-0.5 rounded border border-violet/20">{i + 1}</span>
              <h4 className="font-bold text-sm text-white tracking-tight">{s.title}</h4>
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-medium pl-9">{s.desc}</p>
            {i < steps.length - 1 && (
              <div className="hidden lg:block absolute -right-4 top-1 text-white/5">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-xs font-medium text-red/80">
      <div className="w-1.5 h-1.5 bg-red rounded-full shadow-[0_0_5px_rgba(255,51,102,0.8)]" />
      {text}
    </li>
  );
}
