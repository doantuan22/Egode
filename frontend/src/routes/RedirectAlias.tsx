import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Chuyển hướng giữ tham số, query và hash */
export function RedirectAlias({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const [path, targetHash] = to.split('#');
  const pathname = path.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''));
  return <Navigate replace to={{ pathname, search, hash: targetHash ? `#${targetHash}` : hash }} />;
}
