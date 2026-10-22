'use client';
import type { AdminReport } from '@/types/admin';
import styles from './AdminDashboard.module.css';
const number = (value:number) => value.toLocaleString('en-PK');
const dayLabel = (value:string) => new Date(value+'T00:00:00+05:00').toLocaleDateString('en-PK',{timeZone:'Asia/Karachi',day:'numeric',month:'short'});
export function AdminAnalytics({report}:{report:AdminReport}) {
 const max=Math.max(1,...report.series.map(point=>point.entries));
 const width=720,height=180,pad=12;
 const x=(index:number)=>pad+index*(width-pad*2)/Math.max(1,report.series.length-1);
 const y=(value:number)=>height-pad-value/max*(height-pad*2);
 const points=report.series.map((point,index)=>`${x(index)},${y(point.entries)}`).join(' ');
 const metrics=[['Team entries',report.registrations,'Submitted in this period'],['Awaiting review',report.pending,'Entries with pending approval'],['Checked in',report.checked_in,'Entries ready to compete'],['Verified entry fees','PKR '+number(report.verified_fees),'Verified fees for entries in this period']];
 const statuses=[['Approved',report.approved,'#74dfb1'],['Pending',report.pending,'#ff6a12'],['Rejected',report.rejected,'#f17a88']] as const;
 return <div className={styles.analytics}>
  <div className={styles.metrics}>{metrics.map(([label,value,note])=><article className={styles.metric} key={label}><span>{label}</span><strong>{typeof value==='number'?number(value):value}</strong><small>{note}</small></article>)}</div>
  <div className={styles.chartGrid}>
   <article className={styles.chart}><div className={styles.chartHeading}><div><p className={styles.kicker}>REGISTRATION ACTIVITY</p><h3>Teams joining the competition</h3></div><span className={styles.badge}>Daily · PKT</span></div>
    <div className={styles.plot}><div className={styles.plotScale}><span>{number(max)}</span><span>0</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily tournament entries, ${report.registrations} total in the selected period`}>
     {[0,0.5,1].map(t=><line key={t} x1={pad} x2={width-pad} y1={y(max*t)} y2={y(max*t)} stroke="#ffffff12" strokeDasharray="4 6"/>)}
     <polygon points={`${pad},${height-pad} ${points} ${width-pad},${height-pad}`} fill="#ff6a121a"/>
     <polyline points={points} fill="none" stroke="#ff6a12" strokeWidth="3" strokeLinejoin="round"/>
     {report.series.map((point,index)=><circle key={point.day} cx={x(index)} cy={y(point.entries)} r={report.series.length>31?2:3.5} fill="#ffb27a"><title>{`${dayLabel(point.day)}: ${point.entries} entries`}</title></circle>)}
    </svg></div><div className={styles.axis}><span>{report.series[0]&&dayLabel(report.series[0].day)}</span><span>{report.series.at(-1)&&dayLabel(report.series.at(-1)!.day)}</span></div>
    {report.registrations===0&&<p className={styles.chartNote}>No entries in this period. New registrations will appear here.</p>}
    <details className={styles.chartDetails}><summary>View daily figures</summary><div className={styles.tableScroll}><table><caption>Daily entries and verified fees for those entries</caption><thead><tr><th scope="col">Date (PKT)</th><th scope="col">Team entries</th><th scope="col">Verified fees (PKR)</th></tr></thead><tbody>{report.series.map(point=><tr key={point.day}><th scope="row">{dayLabel(point.day)}</th><td>{point.entries}</td><td>{number(point.verified_fees)}</td></tr>)}</tbody></table></div></details>
   </article>
   <article className={styles.chart}><p className={styles.kicker}>ENTRY BREAKDOWN</p><h3>Approval pipeline</h3><div className={styles.pipelineTotal}><strong>{number(report.registrations)}</strong><span>total team entries</span></div><div className={styles.stacked} aria-label="Registration status distribution">{statuses.map(([label,value,color])=><span key={label} style={{width:`${report.registrations?value/report.registrations*100:0}%`,background:color}}><span className={styles.srOnly}>{label}: {value}</span></span>)}</div><ul className={styles.legend}>{statuses.map(([label,value,color])=><li key={label}><span><i style={{background:color}}/>{label}</span><strong>{number(value)}</strong></li>)}</ul><p className={styles.chartNote}>Pending payment: PKR {number(report.unverified_fees)}. Fees reflect verification status, not a payment processor balance.</p></article>
  </div>
  <p className={styles.source}>Source: recorded tournament registrations · Dates use Pakistan time · Filters use entry submission date. No estimated visits or growth figures.</p>
 </div>;
}
