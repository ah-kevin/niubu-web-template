import { useId, type ReactNode } from 'react';
import { PublicLayout } from '@niubu/layout-ui';
import { useTranslation } from '@niubu/locales/react';
import { PlaygroundBrand } from '../app/Brand';
import { appConfig } from '../app/config';
import './login.css';

function LoginArtwork() {
  const id = useId();
  return (
    <aside className="template-login-art" aria-hidden="true">
      <svg viewBox="0 0 560 460" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${id}-surface`} x1="94" y1="80" x2="470" y2="370" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#e7ecff" />
          </linearGradient>
          <linearGradient id={`${id}-accent`} x1="290" y1="145" x2="430" y2="335" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8a9dfb" />
            <stop offset="1" stopColor="#4f66e7" />
          </linearGradient>
        </defs>
        <circle cx="280" cy="240" r="186" stroke="currentColor" opacity=".12" strokeDasharray="5 9" />
        <circle cx="280" cy="240" r="148" fill="currentColor" opacity=".045" />
        <ellipse cx="286" cy="405" rx="174" ry="15" fill="currentColor" opacity=".07" />
        <g transform="rotate(-6 275 230)">
          <rect x="94" y="88" width="370" height="272" rx="18" fill={`url(#${id}-surface)`} stroke="#cfd8fb" />
          <path d="M94 126H464" stroke="#dce2f8" />
          <circle cx="114" cy="107" r="4" fill="#8496e1" />
          <circle cx="129" cy="107" r="4" fill="#b9c5ef" />
          <circle cx="144" cy="107" r="4" fill="#d4dcf5" />
          <rect x="113" y="146" width="72" height="195" rx="8" fill="#e5eaff" />
          <rect x="125" y="163" width="47" height="8" rx="4" fill="#a7b7f2" />
          <rect x="123" y="190" width="52" height="24" rx="5" fill="#6e85ec" />
          <path d="M128 235H166M128 258H157M128 281H165" stroke="#b6c4f4" strokeWidth="7" strokeLinecap="round" />
          <rect x="204" y="146" width="105" height="63" rx="9" fill="#fff" />
          <rect x="321" y="146" width="123" height="63" rx="9" fill="#fff" />
          <path
            d="M219 165H267M219 189H248M336 165H392M336 189H370"
            stroke="#ced7fa"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <rect x="204" y="224" width="240" height="117" rx="9" fill="#fff" />
          <path d="M221 322H426" stroke="#e8edff" />
          <path
            d="M222 302L258 284L292 291L327 256L361 270L392 242L424 251"
            stroke="#758aed"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M222 302L258 284L292 291L327 256L361 270L392 242L424 251V322H222Z" fill="#758aed" opacity=".08" />
        </g>
        <rect
          x="369"
          y="277"
          width="92"
          height="92"
          rx="23"
          fill={`url(#${id}-accent)`}
          transform="rotate(8 415 323)"
        />
        <path
          d="M393 316L407 330L434 302"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="69"
          y="269"
          width="63"
          height="63"
          rx="17"
          fill="#fff"
          stroke="#d4ddfc"
          transform="rotate(-12 100 300)"
        />
        <path d="M88 291H96V299H88ZM105 291H113V299H105ZM88 307H96V315H88ZM105 307H113V315H105Z" fill="#7d91ed" />
        <circle cx="446" cy="92" r="10" fill="#a9b9f8" />
        <circle cx="105" cy="190" r="5" fill="#a9b9f8" />
        <path
          d="M414 394V406M408 400H420M162 72V84M156 78H168"
          stroke="#93a5ed"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </aside>
  );
}

export function LoginLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('shell');
  return (
    <div className="template-login-layout">
      <PublicLayout
        density="standard"
        sidebarCollapsed={false}
        skipContent={t('skipContent')}
        logo={<PlaygroundBrand href={appConfig.homeHref} />}
        story={<LoginArtwork />}
      >
        {children}
      </PublicLayout>
    </div>
  );
}
