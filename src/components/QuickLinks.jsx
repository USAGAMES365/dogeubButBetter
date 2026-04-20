import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useOptions } from '/src/utils/optionsContext';
import { Plus, Bolt, Globe, Pencil, Trash2, CircleX } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import LinkDialog from './NewQuickLink';
import EditLinkDialog from './EditQuickLink';

const QuickLinks = ({ cls, nav = true, navigating }) => {
  const { options, updateOption } = useOptions();
  const navigate = useNavigate();
  const [fallback, setFallback] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [dialog, setDialog] = useState({ add: false, edit: false, index: null });
  const [shiftHeld, setShiftHeld] = useState(false);
  const menuRef = useRef(null);

  const defaultLinks = [
    { link: 'https://google.com', icon: 'https://google.com/favicon.ico', name: 'Google' },
    { link: 'https://cineby.gd', icon: '/assets/img/fyhn.ico', name: 'Movies' },
    { link: 'https://discord.com', icon: '/assets/img/dsci.ico', name: 'Discord' },
    { link: 'https://github.com', icon: '/assets/img/icogh.ico', name: 'GitHub' },
    { link: 'https://discord.com', icon: 'data:image/jpeg;base64,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', name = 'Discord'}
  ];

  const [quickLinks, setQuickLinks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('options'))?.quickLinks || defaultLinks;
    } catch {
      return defaultLinks;
    }
  });

  const go = (url) => {
    if (nav) {
      navigate("/search", {
        state: {
          url: url,
        }
      });
    } else {
      const processedUrl = navigating.process(url);
      if (processedUrl) {
        navigating.go(navigating.id, processedUrl);
      }
    }
  };

  useEffect(() => {
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(null);
    const down = (e) => e.key === 'Shift' && setShiftHeld(true);
    const up = (e) => e.key === 'Shift' && setShiftHeld(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => updateOption({ quickLinks }), [quickLinks]);

  useEffect(() => {
    setFallback({});
  }, [quickLinks]);

  const linkItem = clsx(
    'flex flex-col items-center justify-center relative group w-20 h-[5.5rem] rounded-md border-transparent cursor-pointer duration-200 ease-in-out',
    options.type === 'dark' ? 'border hover:border-[#ffffff1c]' : 'border-2 hover:border-[#4f4f4f1c]',
    'hover:backdrop-blur'
  );
  const linkLogo = 'w-[2.5rem] h-[2.5rem] flex items-center justify-center rounded-full bg-[#6d6d6d73]';

  return (
    <div className={clsx('flex flex-wrap justify-center gap-4', cls || 'w-full max-w-[40rem] mx-auto mt-[16rem]')}>
      {quickLinks.map((link, i) => (
        <div key={i} className={linkItem} onClick={() => go(link.link)}>
          <div
            ref={menuOpen === i ? menuRef : null}
            onClick={(e) => {
              e.stopPropagation();
              shiftHeld ? setQuickLinks(quickLinks.filter((_, j) => j !== i)) : setMenuOpen(menuOpen === i ? null : i);
            }}
            className={clsx(
              'absolute -top-2 -right-2 duration-200 ease',
              menuOpen === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {shiftHeld ? <CircleX size="16" className="opacity-70 text-red-500" /> : <Bolt size="16" className="opacity-50" />}
            {menuOpen === i && (
              <div
                className="absolute top-5 right-0 rounded-md shadow-lg border border-white/10 py-1 w-[101px] z-50"
                style={{ backgroundColor: options.quickModalBgColor || '#252f3e' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setDialog({ add: false, edit: true, index: i }) || setMenuOpen(null)}
                  className="w-full px-3 py-1.5 text-[0.74rem] flex items-center gap-2 hover:bg-white/10 duration-150 text-left"
                >
                  <Pencil size="14" /> Edit
                </button>
                <button
                  onClick={() => setQuickLinks(quickLinks.filter((_, j) => j !== i)) || setMenuOpen(null)}
                  className="w-full px-3 py-1.5 text-[0.74rem] flex items-center gap-2 hover:bg-white/10 duration-150 text-left text-red-400"
                >
                  <Trash2 size="14" /> Remove
                </button>
              </div>
            )}
          </div>

          <div className={linkLogo}>
            {fallback[i] ? (
              <Globe className="w-7 h-7" />
            ) : (
              <img
                key={link.icon}
                src={link.icon}
                alt={link.name}
                className="w-7 h-7 object-contain"
                loading="lazy"
                onError={() => setFallback((p) => ({ ...p, [i]: true }))}
              />
            )}
          </div>
          <div className="mt-3 text-sm font-medium text-center w-full px-1 overflow-hidden whitespace-nowrap text-ellipsis">
            {link.name}
          </div>
        </div>
      ))}

      <div className={linkItem} onClick={() => setDialog({ add: true, edit: false, index: null })}>
        <div className={linkLogo}>
          <Plus className="w-7 h-7" />
        </div>
        <div className="mt-3 text-sm font-medium text-center">New</div>
      </div>

      <LinkDialog state={dialog.add} set={(v) => setDialog({ ...dialog, add: v })} update={(form) => setQuickLinks([...quickLinks, form])} />
      <EditLinkDialog
        state={dialog.edit}
        set={(v) => setDialog({ ...dialog, edit: v })}
        initialData={dialog.index != null ? quickLinks[dialog.index] : null}
        update={(form) => {
          const updated = [...quickLinks];
          updated[dialog.index] = form;
          setQuickLinks(updated);
        }}
      />
    </div>
  );
};

QuickLinks.displayName = 'QuickLinks';
export default QuickLinks;
