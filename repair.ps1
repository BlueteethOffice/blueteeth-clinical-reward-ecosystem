$path = "app/doctor/earnings/page.tsx"
$content = [System.IO.File]::ReadAllText($path)
$newModal = @"
        {selectedCase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               onClick={() => setSelectedCase(null)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="relative bg-white w-full max-w-xs rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
               <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-2">
                     <div className="h-6 w-6 bg-blue-600/10 rounded flex items-center justify-center text-blue-600">
                        <span className="text-[10px]">📄</span>
                     </div>
                     <h3 className="font-black text-slate-900 text-[10px] uppercase">Case View</h3>
                  </div>
                  <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1 text-xs">✕</button>
               </div>
               
               <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-0.5">
                        <p className="text-[6px] font-black text-slate-300 uppercase">Practitioner</p>
                        <p className="text-slate-900 font-bold text-[9px] uppercase truncate">{selectedCase.patientName}</p>
                     </div>
                     <div className="space-y-0.5 text-right">
                        <p className="text-[6px] font-black text-slate-300 uppercase">Credit</p>
                        <p className="text-blue-600 font-black text-[10px]">+{selectedCase.points} pts</p>
                     </div>
                  </div>

                  <div className="p-2 rounded bg-blue-50/50 border border-blue-100/50 flex justify-between items-center">
                     <span className="text-[8px] font-black text-blue-600 uppercase">Worth</span>
                     <span className="text-[10px] font-black text-blue-700">₹{Math.round((Number(selectedCase.points || 0) + Number(selectedCase.bonusPoints || 0)) * 50).toLocaleString()}</span>
                  </div>

                  <div className="p-2 bg-slate-900 rounded flex items-center justify-between text-white">
                     <div className="flex items-center gap-1.5">
                        <div className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-[7px] font-black uppercase text-emerald-400">Approved</span>
                     </div>
                     <span className="text-[6px] font-black text-slate-400 uppercase">Synced</span>
                  </div>
               </div>
               
               <div className="p-2 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => setSelectedCase(null)} 
                    className="w-full h-8 bg-blue-600 text-white rounded font-black uppercase text-[8px]"
                  >
                     Close
                  </button>
               </div>
            </motion.div>
          </div>
        )}
"@

# Very loose replacement to capture the broken parts
# We find the start of the block and the first AnimatePresence that follows it
$startIndex = $content.IndexOf("selectedCase && (")
if ($startIndex -ge 0) {
    # Find the matching closure. Since we know {selectedCase && ( is followed by )} at line 659
    # We search for the first )} after it.
    $endIndex = $content.IndexOf(")}", $startIndex)
    if ($endIndex -ge 0) {
        $finalContent = $content.Substring(0, $startIndex - 8) + $newModal + $content.Substring($endIndex + 2)
        [System.IO.File]::WriteAllText($path, $finalContent)
        Write-Output "Repair Successful"
    } else {
        Write-Output "End Tag Not Found"
    }
} else {
    Write-Output "Start Tag Not Found"
}
