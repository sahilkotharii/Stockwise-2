import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Package, Download, ShoppingCart } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn } from "../components/UI";
import { fmtCur, toCSV, dlCSV, calcBillGst, safeDate } from "../utils";

export default function PnL({ ctx }) {
  const T = useT();
  const { bills = [], transactions = [], products = [] } = ctx;

  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? `${now.getFullYear()}-04-01` : `${now.getFullYear()-1}-04-01`;
  const fyEnd   = now.getMonth() >= 3 ? `${now.getFullYear()+1}-03-31` : `${now.getFullYear()}-03-31`;
  const [df, setDf] = useState(fyStart);
  const [dt, setDt] = useState(fyEnd);

  const inP = d => { const s = safeDate(d); return s && s >= df && s <= dt; };

  // ── Pre-index transactions ────────────────────────────────────────────────
  const txnsByProduct = useMemo(() => {
    const m = {};
    transactions.forEach(t => { if (!m[t.productId]) m[t.productId] = []; m[t.productId].push(t); });
    return m;
  }, [transactions]);

  // ── Bills in period ───────────────────────────────────────────────────────
  const saleBills = useMemo(() => bills.filter(b => b.type === "sale"     && inP(b.date)), [bills, df, dt]);
  const purBills  = useMemo(() => bills.filter(b => b.type === "purchase" && inP(b.date)), [bills, df, dt]);
  const retTxns   = useMemo(() => transactions.filter(t => t.type === "return"           && inP(t.date)), [transactions, df, dt]);
  const purRetTxns= useMemo(() => transactions.filter(t => t.type === "purchase_return"  && inP(t.date)), [transactions, df, dt]);

  // ── REVENUE ───────────────────────────────────────────────────────────────
  const grossSalesInclGst = useMemo(() => saleBills.reduce((s,b)=>s+Number(b.total||0),0), [saleBills]);
  const gstOnSales        = useMemo(() => saleBills.reduce((s,b)=>s+(calcBillGst(b)||0),0), [saleBills]);
  const grossSalesExclGst = (grossSalesInclGst||0) - (gstOnSales||0);

  const salesReturnValue  = useMemo(() => retTxns.reduce((s,t)=>s+(Number(t.qty)||0)*(Number(t.price)||0),0), [retTxns]);
  const salesReturnGst    = useMemo(() => retTxns.reduce((s,t)=>{
    const rate = (Number(t.gstRate)||0) || (Number(products.find(p=>p.id===t.productId)?.gstRate)||0);
    return s + (Number(t.qty)||0) * (Number(t.price)||0) * (rate||0) / (100+(rate||0));
  }, 0), [retTxns, products]);
  const salesReturnExclGst = (salesReturnValue||0) - (salesReturnGst||0);

  const netSalesInclGst = (grossSalesInclGst||0) - (salesReturnValue||0);
  const netSalesExclGst = (grossSalesExclGst||0) - (salesReturnExclGst||0);

  // ── PURCHASES ─────────────────────────────────────────────────────────────
  const totalPurchaseInclGst = useMemo(() => purBills.reduce((s,b)=>s+Number(b.total||0),0), [purBills]);
  const purchasesExclGst     = useMemo(() => purBills.reduce((s,b)=>s+Number(b.subtotal||0),0), [purBills]);
  const purReturnValue       = useMemo(() => purRetTxns.reduce((s,t)=>s+(Number(t.qty)||0)*(Number(t.price)||0),0), [purRetTxns]);
  const netPurchases         = (purchasesExclGst||0) - (purReturnValue||0);

  // ── COGS ─────────────────────────────────────────────────────────────────
  const openingStock = useMemo(() => {
    const stockAt = (pid, before) =>
      (txnsByProduct[pid] || []).filter(t => {
        const d = safeDate(t.date);
        if (!d) return false;
        return d < before;                      // strictly before period start
      }).reduce((s, t) => {
        const type = t.type || "";
        if (["opening","purchase","return"].includes(type))      return s + (Number(t.qty)||0);
        if (["sale","damaged","purchase_return"].includes(type)) return s - (Number(t.qty)||0);
        return s;
      }, 0);
    return products.reduce((s,pr) => s + Math.max(0, stockAt(pr.id, df)) * (Number(pr.purchasePrice)||0), 0);
  }, [products, txnsByProduct, df]);

  const closingStock = useMemo(() => {
    const stockAt = (pid, upTo) =>
      (txnsByProduct[pid] || []).filter(t => {
        const d = safeDate(t.date);
        if (!d) return false;
        return d <= upTo;                       // on or before period end
      }).reduce((s, t) => {
        const type = t.type || "";
        if (["opening","purchase","return"].includes(type))      return s + (Number(t.qty)||0);
        if (["sale","damaged","purchase_return"].includes(type)) return s - (Number(t.qty)||0);
        return s;
      }, 0);
    return products.reduce((s,pr) => s + Math.max(0, stockAt(pr.id, dt)) * (Number(pr.purchasePrice)||0), 0);
  }, [products, txnsByProduct, dt]);

  const cogs        = (openingStock||0) + (netPurchases||0) - (closingStock||0);
  const grossProfit = (netSalesExclGst||0) - (cogs||0);
  const margin      = netSalesExclGst > 0 ? ((grossProfit/netSalesExclGst)*100) : 0;

  const C = (v, col) => ({ value: v, color: col });
  const R = (label, ...args) => ({ label, ...args[0] });

  const exportCSV = () => dlCSV(toCSV([
    { item:"Gross Sales (incl. GST)",  value: grossSalesInclGst  },
    { item:"GST on Sales",             value: gstOnSales         },
    { item:"Gross Sales (excl. GST)",  value: grossSalesExclGst  },
    { item:"Sales Returns",            value: salesReturnValue   },
    { item:"Net Sales (excl. GST)",    value: netSalesExclGst    },
    { item:"Total Purchase (incl. GST)",value: totalPurchaseInclGst},
    { item:"Purchases (excl. GST)",    value: purchasesExclGst   },
    { item:"Purchase Returns",         value: purReturnValue     },
    { item:"Opening Stock",            value: openingStock       },
    { item:"Closing Stock",            value: closingStock       },
    { item:"COGS",                     value: cogs               },
    { item:"Gross Profit",             value: grossProfit        },
    { item:"Gross Margin %",           value: margin.toFixed(1)+"%"},
  ], ["item","value"]), `pnl_${df}_to_${dt}`);

  const Row = ({ label, value, sub, indent=0, bold=false, color, separator }) => (
    <>
      {separator && <tr><td colSpan={2} style={{padding:"4px 0",borderTop:`1px solid ${T.borderSubtle}`}}/></tr>}
      <tr>
        <td style={{padding:"5px 8px",paddingLeft:8+indent*18,fontWeight:bold?700:400,fontSize:bold?13:12,color:bold?T.text:T.textSub}}>
          {label}
          {sub && <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{sub}</div>}
        </td>
        <td style={{padding:"5px 8px",textAlign:"right",fontWeight:bold?700:500,fontSize:bold?13:12,color:color||(bold?T.text:T.textSub)}}>
          {typeof value==="number"?fmtCur(value):value}
        </td>
      </tr>
    </>
  );

  const dataStatus = `${saleBills.length} sale bills · ${purBills.length} purchase bills · ${retTxns.length} returns`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:18,color:T.text}}>Business Summary</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Indicative P&L · based on recorded transactions</div>
        </div>
        <GBtn v="ghost" sz="sm" onClick={exportCSV} icon={<Download size={13}/>}>Export CSV</GBtn>
      </div>

      {/* Date filter */}
      <div className="glass" style={{padding:"12px 16px",borderRadius:12}}>
        <div className="filter-wrap">
          <span style={{fontSize:11,fontWeight:700,color:T.textMuted}}>PERIOD</span>
          <input type="date" className="inp" value={df} onChange={e=>setDf(e.target.value)} style={{flex:"0 1 130px"}}/>
          <span style={{fontSize:12,color:T.textMuted}}>→</span>
          <input type="date" className="inp" value={dt} onChange={e=>setDt(e.target.value)} style={{flex:"0 1 130px"}}/>
          <button onClick={()=>{setDf(fyStart);setDt(fyEnd);}} style={{padding:"6px 14px",borderRadius:99,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Current FY</button>
          <button onClick={()=>{const y=now.getFullYear();setDf(`${y}-01-01`);setDt(`${y}-12-31`);}} style={{padding:"6px 14px",borderRadius:99,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Calendar Year</button>
          <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto"}}>{dataStatus}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kgrid" style={{gap:12}}>
        {[
          {label:"Total Sales",   value:grossSalesInclGst, sub:"incl. GST",        icon:TrendingUp,  color:T.green},
          {label:"Net Sales",     value:netSalesExclGst,   sub:"excl. GST",         icon:DollarSign,  color:T.accent},
          {label:"Total Purchase",value:totalPurchaseInclGst,sub:"incl. GST",      icon:ShoppingCart,color:T.blue},
          {label:"Gross Profit",  value:grossProfit,       sub:`${margin.toFixed(1)}% margin`, icon:TrendingDown,color:grossProfit>=0?T.green:T.red},
          {label:"Closing Stock", value:closingStock,      sub:"ex-GST · at cost",  icon:Package,     color:T.amber},
        ].map((k,i)=>(
          <div key={i} className="kcard glass">
            <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:`${k.color}12`}}/>
            <div style={{width:34,height:34,borderRadius:9,background:`${k.color}1A`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><k.icon size={15} color={k.color}/></div>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:18,color:k.value<0?T.red:T.text}}>{fmtCur(k.value)}</div>
            <div style={{fontSize:11,fontWeight:600,color:T.textSub,marginTop:1}}>{k.label}</div>
            <div style={{fontSize:11,color:T.textMuted}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column table layout */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

        {/* P&L Table */}
        <div className="glass" style={{padding:20,borderRadius:T.radius}}>
          <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>📊 Profit & Loss</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <tbody>
              <Row label="SALES" bold/>
              <Row label="Gross Sales (incl. GST)"  value={grossSalesInclGst}    indent={1} color={T.green}/>
              <Row label="Less: GST on Sales"       value={-gstOnSales}          indent={1} color={T.textMuted}/>
              <Row label="Gross Sales (excl. GST)"  value={grossSalesExclGst}    indent={1} bold/>
              <Row label="Less: Sales Returns"      value={-salesReturnValue}    indent={1} color={T.red}/>
              <Row label="Net Sales (excl. GST)"    value={netSalesExclGst}      bold color={T.green} separator/>

              <Row label="COST OF GOODS SOLD" bold/>
              <Row label="Opening Stock"            value={openingStock}         indent={1}/>
              <Row label="Add: Purchases (excl. GST)" value={purchasesExclGst}  indent={1} color={T.blue}/>
              <Row label="Less: Purchase Returns"   value={-purReturnValue}      indent={1} color={T.textMuted}/>
              <Row label="Less: Closing Stock"      value={-closingStock}        indent={1} color={T.textMuted}/>
              <Row label="Total COGS"               value={cogs}                 bold color={T.red} separator/>

              <Row label="GROSS PROFIT"             value={grossProfit}          bold color={grossProfit>=0?T.green:T.red} separator/>
              <Row label="Gross Margin"             value={margin.toFixed(1)+"%"} indent={1} color={T.textMuted}/>
            </tbody>
          </table>
        </div>

        {/* Inventory & Purchase Summary */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>📦 Inventory</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                <Row label="Opening Stock Value"  value={openingStock}  indent={1}/>
                <Row label="Purchases (excl. GST)" value={purchasesExclGst} indent={1} color={T.blue}/>
                <Row label="Sales Returns Added"  value={salesReturnValue} indent={1} color={T.green}/>
                <Row label="Less: Cost of Goods Sold" value={-cogs}     indent={1} color={T.red}/>
                <Row label="Closing Stock Value"  value={closingStock}  bold color={T.accent} separator/>
                <Row label="Stock Movement"       value={closingStock-openingStock} indent={1} color={closingStock>=openingStock?T.green:T.red}/>
              </tbody>
            </table>
          </div>

          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>🛒 Purchase Summary</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                <Row label="Total Paid (incl. GST)" value={totalPurchaseInclGst} bold color={T.blue}/>
                <Row label="Cost (excl. GST)"       value={purchasesExclGst}  indent={1}/>
                <Row label="GST Paid"               value={totalPurchaseInclGst-purchasesExclGst} indent={1} color={T.amber}/>
                <Row label="Purchase Returns"       value={purReturnValue}    indent={1} color={T.red}/>
                <Row label="Net Purchases (excl. GST)" value={netPurchases}  bold separator/>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{padding:"10px 14px",borderRadius:10,background:T.amberBg,fontSize:11,color:T.amber,border:`1px solid ${T.amber}30`}}>
        ⚠️ This is an indicative summary only. For certified accounts or GST filing, please consult your CA with the full CSV export.
      </div>
    </div>
  );
}
