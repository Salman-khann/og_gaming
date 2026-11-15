import { ShimmerLoader } from './shimmer-loader';
import styles from './shimmer-loader.module.css';

const labels = ['Loading the arena...', 'Preparing your page...'];
export function ArenaLoading({ route = false }: { route?: boolean }) {
  return (
    <div className={styles.panel + (route ? ' ' + styles.route : '')}>
      <ShimmerLoader labels={labels} showPercent={false} loop duration={2200} cellPadding={1} />
    </div>
  );
}
