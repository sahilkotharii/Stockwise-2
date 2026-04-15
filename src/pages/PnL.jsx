import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Package, Download, ShoppingCart } from "lucide-react";
import { useT } from "../theme";
import { GBtn, GIn, KCard } from "../components/UI";
import { fmtCur, toCSV, dlCSV, calcBillGst, safeDate, safeNum, sGst, sQty, sPrice, sEffPrice, sGstAmt } from "../utils";

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
  const grossSalesInclGst = useMemo(() => saleBills.reduce((s,b)=>s+safeNum(b.total),0), [saleBills]);
  const gstOnSales        = useMemo(() => saleBills.reduce((s,b)=>s+(calcBillGst(b)||0),0), [saleBills]);
  const grossSalesExclGst = (grossSalesInclGst||0) - (gstOnSales||0);

  // Sale returns — value, GST, and net
  const salesReturnValue  = useMemo(() => retTxns.reduce((s,t)=>s+sQty(t)*sPrice(t),0), [retTxns]);
  const salesReturnGst    = useMemo(() => retTxns.reduce((s,t)=>{
    const rate = sGst(t) || safeNum(products.find(p=>p.id===t.productId)?.gstRate);
    return s + sQty(t) * sPrice(t) * rate / (100+rate);
  }, 0), [retTxns, products]);
  const salesReturnExclGst = (salesReturnValue||0) - (salesReturnGst||0);

  const netSalesInclGst = (grossSalesInclGst||0) - (salesReturnValue||0);
  const netSalesExclGst = (grossSalesExclGst||0) - (salesReturnExclGst||0);

  // ── PURCHASES ─────────────────────────────────────────────────────────────
  const totalPurchaseInclGst = useMemo(() => purBills.reduce((s,b)=>s+safeNum(b.total),0), [purBills]);
  const purchasesExclGst     = useMemo(() => purBills.reduce((s,b)=>s+safeNum(b.subtotal),0), [purBills]);
  const gstOnPurchases       = totalPurchaseInclGst - purchasesExclGst;

  // Purchase returns — value, GST, and net
  const purReturnValue       = useMemo(() => purRetTxns.reduce((s,t)=>s+sQty(t)*sPrice(t),0), [purRetTxns]);
  const purReturnGst         = useMemo(() => purRetTxns.reduce((s,t)=>{
    const rate = sGst(t) || safeNum(products.find(p=>p.id===t.productId)?.gstRate);
    return s + sQty(t) * sPrice(t) * rate / 100;
  }, 0), [purRetTxns, products]);
  const purReturnExclGst     = (purReturnValue||0) - (purReturnGst||0);

  const netPurchases         = (purchasesExclGst||0) - (purReturnExclGst||0);

  // ── COGS ─────────────────────────────────────────────────────────────────
  const openingStock = useMemo(() => {
    const stockAt = (pid, before) =>
      (txnsByProduct[pid] || []).filter(t => {
        const d = safeDate(t.date);
        if (!d) return false;
        const type = t.type || "";
        if (type === "opening") return d <= before;
        return d < before;
      }).reduce((s, t) => {
        const type = t.type || "";
        if (["opening","purchase","return"].includes(type))      return s + sQty(t);
        if (["sale","damaged","purchase_return"].includes(type)) return s - sQty(t);
        return s;
      }, 0);
    return products.reduce((s,pr) => s + Math.max(0, stockAt(pr.id, df)) * safeNum(pr.purchasePrice), 0);
  }, [products, txnsByProduct, df]);

  const closingStock = useMemo(() => {
    const stockAt = (pid, upTo) =>
      (txnsByProduct[pid] || []).filter(t => {
        const d = safeDate(t.date);
        if (!d) return false;
        return d <= upTo;
      }).reduce((s, t) => {
        const type = t.type || "";
        if (["opening","purchase","return"].includes(type))      return s + sQty(t);
        if (["sale","damaged","purchase_return"].includes(type)) return s - sQty(t);
        return s;
      }, 0);
    return products.reduce((s,pr) => s + Math.max(0, stockAt(pr.id, dt)) * safeNum(pr.purchasePrice), 0);
  }, [products, txnsByProduct, dt]);

  const cogs        = (openingStock||0) + (netPurchases||0) - (closingStock||0);
  const grossProfit = (netSalesExclGst||0) - (cogs||0);
  const margin      = netSalesExclGst > 0 ? ((grossProfit/netSalesExclGst)*100) : 0;

  const exportCSV = () => dlCSV(toCSV([
    { item:"Gross Sales (incl. GST)",   value: grossSalesInclGst  },
    { item:"GST on Sales",              value: gstOnSales         },
    { item:"Gross Sales (excl. GST)",   value: grossSalesExclGst  },
    { item:"Sales Returns (incl. GST)", value: salesReturnValue   },
    { item:"Sales Return GST",          value: salesReturnGst     },
    { item:"Sales Returns (excl. GST)", value: salesReturnExclGst },
    { item:"Net Sales (excl. GST)",     value: netSalesExclGst    },
    { item:"Total Purchase (incl. GST)",value: totalPurchaseInclGst},
    { item:"Purchases (excl. GST)",     value: purchasesExclGst   },
    { item:"GST on Purchases",          value: gstOnPurchases     },
    { item:"Purchase Returns (incl GST)",value: purReturnValue    },
    { item:"Purchase Return GST",       value: purReturnGst       },
    { item:"Purchase Returns (excl GST)",value: purReturnExclGst  },
    { item:"Net Purchases (excl. GST)", value: netPurchases       },
    { item:"Opening Stock",             value: openingStock       },
    { item:"Closing Stock",             value: closingStock       },
    { item:"COGS",                      value: cogs               },
    { item:"Gross Profit",              value: grossProfit        },
    { item:"Gross Margin %",            value: margin.toFixed(1)+"%"},
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

  const dataStatus = `${saleBills.length} sale bills · ${purBills.length} purchase bills · ${retTxns.length} sale returns · ${purRetTxns.length} purchase returns`;

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
      <div className="glass" style={{padding:"12px 16px",borderRadius: T.radius}}>
        <div className="filter-wrap">
          <span style={{fontSize:11,fontWeight:700,color:T.textMuted}}>PERIOD</span>
          <input type="date" className="inp" value={df} onChange={e=>setDf(e.target.value)} style={{flex:"0 1 130px"}}/>
          <span style={{fontSize:12,color:T.textMuted}}>→</span>
          <input type="date" className="inp" value={dt} onChange={e=>setDt(e.target.value)} style={{flex:"0 1 130px"}}/>
          <button onClick={()=>{setDf(fyStart);setDt(fyEnd);}} style={{padding:"6px 14px",borderRadius: T.radiusFull,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Current FY</button>
          <button onClick={()=>{const y=now.getFullYear();setDf(`${y}-01-01`);setDt(`${y}-12-31`);}} style={{padding:"6px 14px",borderRadius: T.radiusFull,fontSize:11,fontWeight:600,border:`1px solid ${T.borderSubtle}`,cursor:"pointer",background:"transparent",color:T.textSub}}>Calendar Year</button>
          <span style={{fontSize:11,color:T.textMuted,marginLeft:"auto"}}>{dataStatus}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kgrid">
        {[
          {label:"Total Sales",   value:grossSalesInclGst, sub:"incl. GST",        icon:TrendingUp,  color:T.green},
          {label:"Net Sales",     value:netSalesExclGst,   sub:"excl. GST",         icon:DollarSign,  color:T.accent},
          {label:"Total Purchase",value:totalPurchaseInclGst,sub:"incl. GST",      icon:ShoppingCart,color:T.blue},
          {label:"Gross Profit",  value:grossProfit,       sub:`${margin.toFixed(1)}% margin`, icon:TrendingDown,color:grossProfit>=0?T.green:T.red},
          {label:"Closing Stock", value:closingStock,      sub:"ex-GST · at cost",  icon:Package,     color:T.amber},
        ].map((k,i)=>(
          <KCard key={i} label={k.label} value={fmtCur(k.value)} sub={k.sub} icon={k.icon} color={k.color} />
        ))}
      </div>

      {/* Two-column table layout */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>

        {/* P&L Table */}
        <div className="glass" style={{padding:20,borderRadius:T.radius}}>
          <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Profit & Loss</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <tbody>
              <Row label="SALES" bold/>
              <Row label="Gross Sales (incl. GST)"  value={grossSalesInclGst}    indent={1} color={T.green}/>
              <Row label="Less: GST on Sales"       value={-gstOnSales}          indent={1} color={T.textMuted}/>
              <Row label="Gross Sales (excl. GST)"  value={grossSalesExclGst}    indent={1} bold/>
              <Row label="Less: Sales Returns"      value={-salesReturnValue}    indent={1} color={T.red}/>
              <Row label="  of which GST"           value={salesReturnGst}       indent={2} color={T.textMuted} sub="GST credited back to customer"/>
              <Row label="Net Sales (excl. GST)"    value={netSalesExclGst}      bold color={T.green} separator/>

              <Row label="COST OF GOODS SOLD" bold/>
              <Row label="Opening Stock"            value={openingStock}         indent={1}/>
              <Row label="Add: Purchases (excl. GST)" value={purchasesExclGst}  indent={1} color={T.blue}/>
              <Row label="Less: Purchase Returns"   value={-purReturnExclGst}    indent={1} color={T.textMuted}/>
              <Row label="  of which GST"           value={purReturnGst}         indent={2} color={T.textMuted} sub="GST reversed from vendor"/>
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
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Inventory</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                <Row label="Opening Stock Value"     value={openingStock}           indent={1}/>
                <Row label="Add: Purchases (ex-GST)" value={purchasesExclGst}      indent={1} color={T.blue}/>
                <Row label="Less: Purchase Returns"  value={-purReturnExclGst}      indent={1} color={T.red}/>
                <Row label="Add: Sales Returns"      value={salesReturnExclGst}     indent={1} color={T.green}/>
                <Row label="Less: Cost of Goods Sold" value={-cogs}                indent={1} color={T.red}/>
                <Row label="Closing Stock Value"     value={closingStock}           bold color={T.accent} separator/>
                <Row label="Stock Movement"          value={closingStock-openingStock} indent={1} color={closingStock>=openingStock?T.green:T.red}/>
              </tbody>
            </table>
          </div>

          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Purchase Summary</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                <Row label="Total Paid (incl. GST)" value={totalPurchaseInclGst} bold color={T.blue}/>
                <Row label="Cost (excl. GST)"       value={purchasesExclGst}  indent={1}/>
                <Row label="GST Paid"               value={gstOnPurchases}    indent={1} color={T.amber}/>
                <Row label="Purchase Returns (incl)" value={purReturnValue}   indent={1} color={T.red}/>
                <Row label="  GST component"         value={purReturnGst}     indent={2} color={T.textMuted}/>
                <Row label="Net Purchases (excl. GST)" value={netPurchases}  bold separator/>
              </tbody>
            </table>
          </div>

          <div className="glass" style={{padding:20,borderRadius:T.radius}}>
            <div style={{fontFamily:T.displayFont,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>GST Summary</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <tbody>
                <Row label="GST Collected (on Sales)"       value={gstOnSales}      indent={1} color={T.green}/>
                <Row label="Less: Sale Return GST"          value={-salesReturnGst}  indent={1} color={T.red}/>
                <Row label="Net GST Collected"              value={gstOnSales - salesReturnGst} bold separator/>
                <Row label="GST Paid (on Purchases)"        value={gstOnPurchases}  indent={1} color={T.blue}/>
                <Row label="Less: Purchase Return GST"      value={-purReturnGst}   indent={1} color={T.red}/>
                <Row label="Net GST Paid"                   value={gstOnPurchases - purReturnGst} bold separator/>
                <Row label="Approx. GST Liability"          value={(gstOnSales - salesReturnGst) - (gstOnPurchases - purReturnGst)} bold color={T.accent} separator/>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{padding:"10px 14px",borderRadius: T.radius,background:T.amberBg,fontSize:11,color:T.amber,border:`1px solid ${T.amber}30`}}>
         This is an indicative summary only. For certified accounts or GST filing, please consult your CA with the full CSV export.
      </div>
    </div>
  );
}
