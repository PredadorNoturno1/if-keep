import React, { useState, useEffect } from 'react';
import styled, { ThemeProvider, createGlobalStyle, DefaultTheme } from 'styled-components';
import * as MdIcons from 'react-icons/md';
import axios from 'axios';

const API_URL = 'http://localhost:3001';

// --- ESTILOS E TIPAGEM ---
declare module 'styled-components' {
  export interface DefaultTheme {
    isDark: boolean; primary: string; bg: string; surface: string;
    text: string; border: string; hover: string;
    sidebarBg: string; textSecondary: string;
  }
}

const { 
  MdHome, MdSettings, MdDelete, MdArchive, MdUnarchive, MdAdd, MdClose,
  MdPalette, MdDarkMode, MdLightMode, MdChevronRight, MdContentCopy, MdLogout
} = MdIcons as any;

const GlobalStyle = createGlobalStyle`
  body { margin: 0; font-family: 'Inter', sans-serif; background: ${p => p.theme.bg}; color: ${p => p.theme.text}; transition: 0.3s ease; }
  * { box-sizing: border-box; }
`;

const NOTE_COLORS = [
  { name: 'Padrão', color: 'transparent' }, { name: 'Coral', color: '#f28b82' }, { name: 'Ouro', color: '#fbbc04' },
  { name: 'Amarelo', color: '#fff475' }, { name: 'Verde', color: '#ccff90' }, { name: 'Azul', color: '#aecbfa' },
  { name: 'Roxo', color: '#d7aefb' }, { name: 'Rosa', color: '#fdcfe8' },
];

const Layout = styled.div`display: flex; height: 100vh; overflow: hidden;`;
const Sidebar = styled.div`width: 260px; background: ${p => p.theme.sidebarBg}; border-right: 1px solid ${p => p.theme.border}; display: flex; flex-direction: column; padding: 20px 0;`;
const Logo = styled.div`font-size: 24px; font-weight: 800; padding: 0 24px 30px; cursor: pointer; display: flex; gap: 6px; justify-content: center;`;
const NavItem = styled.div<{ active?: boolean }>`
  padding: 12px 24px; margin: 2px 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; 
  background: ${p => p.active ? p.theme.primary + '15' : 'transparent'}; color: ${p => p.active ? p.theme.primary : p.theme.textSecondary}; 
  border-radius: 12px; font-weight: 600; transition: 0.2s; &:hover { background: ${p => p.theme.hover}; }
`;
const Main = styled.div`flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; align-items: center;`;
const SubjectCard = styled.div`
  background: ${p => p.theme.surface}; border: 1px solid ${p => p.theme.border}; padding: 30px; border-radius: 20px; cursor: pointer; transition: 0.3s;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  &:hover { transform: translateY(-8px); box-shadow: 0 12px 20px rgba(0,0,0,0.1); border-color: ${p => p.theme.primary}; }
  h2 { margin: 0; font-size: 18px; text-align: center; }
`;
const NoteCard = styled.div<{ noteColor: string }>`
  background: ${p => p.noteColor === 'transparent' ? p.theme.surface : p.noteColor}; color: ${p => p.noteColor === 'transparent' ? p.theme.text : '#202124'}; 
  padding: 20px; border-radius: 16px; border: 1px solid ${p => p.theme.border}; display: flex; flex-direction: column; position: relative; transition: 0.2s;
  &:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
`;
const ColorMenu = styled.div`
  position: absolute; bottom: 40px; right: 10px; background: ${p => p.theme.surface}; padding: 8px; border-radius: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; box-shadow: 0 8px 16px rgba(0,0,0,0.2); z-index: 50; border: 1px solid ${p => p.theme.border};
`;
const ModalOverlay = styled.div`position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px;`;
const Modal = styled.div`background: ${p => p.theme.surface}; padding: 30px; border-radius: 24px; width: 100%; max-width: 450px; border: 1px solid ${p => p.theme.border};`;

const AuthContainer = styled.div`height: 100vh; display: flex; align-items: center; justify-content: center; background: ${p => p.theme.bg};`;
const AuthCard = styled(Modal)`text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.1);`;
const AuthInput = styled.input`width: 100%; padding: 14px; margin-bottom: 15px; border-radius: 12px; border: 2px solid ${p => p.theme.border}; background: ${p => p.theme.bg}; color: ${p => p.theme.text}; outline: none; font-size: 15px; &:focus { border-color: ${p => p.theme.primary}; }`;
const AuthButton = styled.button`width: 100%; padding: 14px; background: ${p => p.theme.primary}; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; &:hover { opacity: 0.9; transform: scale(0.98); }`;

interface Note { id: number; title: string; content: string; color: string; subject: string; archived: boolean; date: string; lastEdited?: string; }

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const primary = '#10b981';

  // --- ESTADOS DE AUTENTICAÇÃO E RECUPERAÇÃO ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
  
  // Modos possíveis: 'login', 'register', 'reset'
  const [authMode, setAuthMode] = useState<'login'|'register'|'reset'>('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', secret_word: '', newPassword: '' });
  
  // --- ESTADOS DO APP ---
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [activeColorMenu, setActiveColorMenu] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'note' | 'subject', id: any } | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null); 

  const theme: DefaultTheme = {
    isDark, primary, bg: isDark ? '#0f172a' : '#f8fafc', sidebarBg: isDark ? '#1e293b' : '#ffffff',
    surface: isDark ? '#1e293b' : '#ffffff', text: isDark ? '#f1f5f9' : '#1e293b',
    textSecondary: isDark ? '#94a3b8' : '#64748b', border: isDark ? '#334155' : '#e2e8f0', hover: isDark ? '#334155' : '#f1f5f9',
  };

  const getTime = () => new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  const api = axios.create({ baseURL: API_URL, headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => { if (token) fetchData(); }, [token]);

  const fetchData = async () => {
    try {
      const [resSub, resNotes] = await Promise.all([ api.get('/subjects'), api.get('/notes') ]);
      setSubjects(resSub.data); setNotes(resNotes.data);
    } catch (err) { console.error("Erro ao carregar dados", err); }
  };

  // --- FUNÇÕES DE AUTH ---
  const handleLoginRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = authMode === 'register' ? '/register' : '/login';
      const res = await axios.post(`${API_URL}${endpoint}`, authForm);
      if (authMode === 'register') {
        alert("Conta criada! Faça login agora.");
        setAuthMode('login');
      } else {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', res.data.username);
        setToken(res.data.token); setUsername(res.data.username);
      }
    } catch (err: any) { alert(err.response?.data?.error || "Erro de conexão."); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/reset-password`, authForm);
      alert("Senha atualizada com sucesso! Você já pode fazer login.");
      setAuthMode('login');
    } catch (err: any) { alert(err.response?.data?.error || "Erro ao redefinir a senha."); }
  };

  const handleLogout = () => { localStorage.clear(); setToken(null); setUsername(null); };

  // --- FUNÇÕES DE ROTINA DO APP AQUI ---
  const handleAddSubject = async () => { 
    if (newSubName && !subjects.includes(newSubName)) { 
      try { 
        await api.post(`/subjects`, { name: newSubName }); 
        setNewSubName(''); 
        setShowSubModal(false); 
        fetchData(); 
      } catch (err: any) { 
        alert(err.response?.data?.error || "Erro ao salvar matéria no banco."); 
      } 
    } 
  };
  
  const handleSaveNote = async () => { 
    const tInput = document.getElementById('noteTitle') as HTMLInputElement; 
    const cInput = document.getElementById('noteContent') as HTMLTextAreaElement; 
    if (tInput.value || cInput.value) { 
      try { 
        await api.post(`/notes`, { title: tInput.value, content: cInput.value, color: 'transparent', subject: activeSub || 'Geral', archived: false, date: getTime() }); 
        fetchData(); 
        tInput.value = ''; cInput.value = ''; 
      } catch (err: any) { 
        alert(err.response?.data?.error || "Erro ao salvar a nota."); 
      } 
    } 
  };
  
  const handleUpdateNote = async (id: number, fields: Partial<Note>) => { try { await api.put(`/notes/${id}`, fields); fetchData(); } catch (err) {} };
  const handleDuplicateNote = async (note: Note) => { const { id, ...noteData } = note; try { await api.post(`/notes`, { ...noteData, title: `${note.title} (Cópia)`, date: getTime() }); fetchData(); } catch (err) {} };
  const confirmDelete = async () => { if (!deleteTarget) return; try { if (deleteTarget.type === 'note') { await api.delete(`/notes/${deleteTarget.id}`); } else { await api.delete(`/subjects/${deleteTarget.id}`); if(activeSub === deleteTarget.id) setActiveSub(null); } setDeleteTarget(null); fetchData(); } catch (err) {} };

  const filteredNotes = notes.filter(n => n.subject === activeSub && (view === 'active' ? !n.archived : n.archived));

  // --- RENDERIZAÇÃO DAS TELAS DE AUTH ---
  if (!token) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <AuthContainer>
          <AuthCard>
            <Logo style={{marginBottom: 10}}><span style={{ color: '#10b981' }}>IF</span> <span style={{ color: '#f59e0b' }}>Keep</span></Logo>
            
            {/* TELA DE LOGIN OU REGISTRO */}
            {(authMode === 'login' || authMode === 'register') && (
              <>
                <h2 style={{marginBottom: 25}}>{authMode === 'register' ? 'Crie sua conta' : 'Acesse suas notas'}</h2>
                <form onSubmit={handleLoginRegister}>
                  {authMode === 'register' && <AuthInput placeholder="Nome de usuário" required onChange={e => setAuthForm({...authForm, username: e.target.value})} />}
                  
                  <AuthInput type="email" placeholder="E-mail" required onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                  <AuthInput type="password" placeholder="Senha" required onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                  
                  {authMode === 'register' && (
                    <AuthInput type="text" placeholder="Crie uma Palavra-Secreta (Para recuperar senha)" required onChange={e => setAuthForm({...authForm, secret_word: e.target.value})} />
                  )}
                  
                  <AuthButton type="submit">{authMode === 'register' ? 'Cadastrar' : 'Entrar'}</AuthButton>
                </form>
                
                <div style={{marginTop: 20, fontSize: 14, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 10}}>
                  <span style={{cursor: 'pointer'}} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                    {authMode === 'register' ? 'Já tem conta? Faça Login' : 'Não tem conta? Cadastre-se'}
                  </span>
                  {authMode === 'login' && (
                    <span style={{cursor: 'pointer', color: primary, fontWeight: 'bold'}} onClick={() => setAuthMode('reset')}>
                      Esqueceu sua senha?
                    </span>
                  )}
                </div>
              </>
            )}

            {/* TELA DE RECUPERAR SENHA (DIRETO COM PIN) */}
            {authMode === 'reset' && (
              <>
                <h2 style={{marginBottom: 10}}>Recuperar Senha</h2>
                <p style={{color: theme.textSecondary, marginBottom: 20, fontSize: 14}}>Digite seu e-mail e a Palavra-Secreta criada no cadastro.</p>
                <form onSubmit={handleResetPassword}>
                  <AuthInput type="email" placeholder="Seu E-mail" required onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                  <AuthInput type="text" placeholder="Sua Palavra-Secreta" required onChange={e => setAuthForm({...authForm, secret_word: e.target.value})} />
                  <AuthInput type="password" placeholder="Sua Nova Senha" required onChange={e => setAuthForm({...authForm, newPassword: e.target.value})} />
                  <AuthButton type="submit">Atualizar Senha</AuthButton>
                </form>
                <p style={{marginTop: 20, fontSize: 14, color: theme.textSecondary, cursor: 'pointer', fontWeight: 'bold'}} onClick={() => setAuthMode('login')}>
                  Voltar para o Login
                </p>
              </>
            )}

          </AuthCard>
        </AuthContainer>
      </ThemeProvider>
    );
  }

  // --- RENDERIZAÇÃO APP PRINCIPAL ---
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Layout>
        <Sidebar>
          <Logo onClick={() => setActiveSub(null)}><span style={{ color: '#10b981' }}>IF</span> <span style={{ color: '#f59e0b' }}>Keep</span></Logo>
          <NavItem active={activeSub === null} onClick={() => setActiveSub(null)}><MdHome size={22}/> Início</NavItem>
          <div style={{padding: '25px 24px 10px', fontSize: 11, fontWeight: 'bold', color: theme.textSecondary, display: 'flex', justifyContent: 'space-between'}}>MINHAS MATÉRIAS <MdAdd size={20} cursor="pointer" onClick={() => setShowSubModal(true)}/></div>
          {subjects.map(s => (
            <NavItem key={s} active={activeSub === s} onClick={() => {setActiveSub(s); setView('active');}}>
              <div style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis'}}>{s}</div>
              <MdDelete size={16} onClick={(e: any) => { e.stopPropagation(); setDeleteTarget({type: 'subject', id: s}); }}/>
            </NavItem>
          ))}
          <div style={{marginTop: 'auto'}}>
            <NavItem onClick={() => setShowSettings(true)}><MdSettings size={22}/> Configurações</NavItem>
            <NavItem onClick={handleLogout} style={{color: '#ef4444'}}><MdLogout size={22}/> Sair</NavItem>
          </div>
        </Sidebar>

        <Main>
          {!activeSub ? (
            <div style={{width: '100%', maxWidth: 1000}}>
              <h1>Olá, {username}! 👋</h1>
              <p style={{color: theme.textSecondary, marginBottom: 40}}>Suas anotações estão seguras aqui.</p>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 25}}>
                {subjects.map(s => (
                  <SubjectCard key={s} onClick={() => setActiveSub(s)}>
                    <div style={{background: primary + '20', padding: 20, borderRadius: '50%', color: primary}}><MdChevronRight size={30}/></div>
                    <h2>{s}</h2>
                    <span style={{fontSize: 12, color: theme.textSecondary}}>{notes.filter(n => n.subject === s && !n.archived).length} notas ativas</span>
                  </SubjectCard>
                ))}
                <SubjectCard style={{borderStyle: 'dashed', background: 'transparent'}} onClick={() => setShowSubModal(true)}>
                  <MdAdd size={40} color={theme.border}/><h2>Nova Matéria</h2>
                </SubjectCard>
              </div>
            </div>
          ) : (
            <div style={{width: '100%', maxWidth: 900}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30}}>
                <h1 style={{margin: 0}}>{activeSub}</h1>
                <div style={{display: 'flex', background: theme.hover, padding: 4, borderRadius: 12}}>
                  <button onClick={() => setView('active')} style={{border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', background: view === 'active' ? theme.surface : 'transparent', color: view === 'active' ? primary : theme.textSecondary, fontWeight: 'bold'}}>Ativas</button>
                  <button onClick={() => setView('archived')} style={{border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', background: view === 'archived' ? theme.surface : 'transparent', color: view === 'archived' ? primary : theme.textSecondary, fontWeight: 'bold'}}>Arquivo</button>
                </div>
              </div>

              {view === 'active' && (
                <div style={{background: theme.surface, padding: 20, borderRadius: 16, border: `2px solid ${theme.border}`, marginBottom: 40}}>
                    <input placeholder="Título da nota..." id="noteTitle" style={{width:'100%', border:'none', background:'transparent', outline:'none', fontWeight:'bold', fontSize:18, color:theme.text, marginBottom:10}} />
                    <textarea placeholder="Escreva sua ideia aqui..." id="noteContent" style={{width:'100%', border:'none', background:'transparent', outline:'none', fontSize:16, color:theme.text, resize:'none', minHeight: 60}} />
                    <div style={{display:'flex', justifyContent:'flex-end'}}>
                      <button onClick={handleSaveNote} style={{background:primary, color:'white', border:'none', padding:'10px 25px', borderRadius:10, fontWeight:'bold', cursor:'pointer'}}>Salvar Nota</button>
                    </div>
                </div>
              )}

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20}}>
                {filteredNotes.map((n) => (
                  <NoteCard key={n.id} noteColor={n.color}>
                    <div style={{flex: 1, cursor: 'pointer', overflow: 'hidden'}} onClick={() => setEditingNote(n)}>
                      <h3 style={{margin: '0 0 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{n.title || 'Sem título'}</h3>
                      <p style={{margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{n.content}</p>
                    </div>
                    
                    <div style={{marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span style={{fontSize: 10, color: n.color === 'transparent' ? theme.textSecondary : 'rgba(0,0,0,0.5)', fontWeight: 'bold'}}>
                        {n.lastEdited ? `Editado: ${n.lastEdited}` : `Criado: ${n.date}`}
                      </span>
                      <div style={{display: 'flex', gap: 10, color: n.color === 'transparent' ? theme.textSecondary : 'rgba(0,0,0,0.6)'}}>
                        <MdPalette size={18} cursor="pointer" onClick={() => setActiveColorMenu(activeColorMenu === n.id ? null : n.id)}/>
                        {activeColorMenu === n.id && (
                          <ColorMenu>
                            {NOTE_COLORS.map(c => <div key={c.color} onClick={() => { handleUpdateNote(n.id, {color: c.color}); setActiveColorMenu(null); }} style={{width:24, height:24, borderRadius:'50%', background:c.color, border:'1px solid rgba(0,0,0,0.1)', cursor:'pointer'}} />)}
                          </ColorMenu>
                        )}
                        <MdContentCopy size={18} cursor="pointer" onClick={() => handleDuplicateNote(n)} />
                        <div onClick={() => handleUpdateNote(n.id, {archived: !n.archived})}>
                          {n.archived ? <MdUnarchive size={18} cursor="pointer"/> : <MdArchive size={18} cursor="pointer"/>}
                        </div>
                        <MdDelete size={18} cursor="pointer" onClick={() => setDeleteTarget({type: 'note', id: n.id})}/>
                      </div>
                    </div>
                  </NoteCard>
                ))}
              </div>
            </div>
          )}
        </Main>

        {/* --- MODAIS MANTIDOS --- */}
        {deleteTarget && (
          <ModalOverlay><Modal>
            <h3 style={{marginTop:0}}>Confirmar Exclusão?</h3>
            <p>Essa ação não pode ser desfeita.</p>
            <div style={{display:'flex', gap:10, marginTop:25}}>
              <button onClick={() => setDeleteTarget(null)} style={{flex:1, padding:12, borderRadius:12, border:'none', background: theme.hover, color: theme.text}}>Cancelar</button>
              <button onClick={confirmDelete} style={{flex:1, padding:12, borderRadius:12, border:'none', background:'#ef4444', color:'white', fontWeight:'bold', cursor:'pointer'}}>Excluir</button>
            </div>
          </Modal></ModalOverlay>
        )}

        {showSubModal && (
          <ModalOverlay><Modal>
            <h3 style={{marginTop:0}}>Criar Nova Matéria</h3>
            <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Ex: Matemática" style={{width:'100%', padding:12, borderRadius:12, border:`2px solid ${theme.border}`, background:theme.bg, color:theme.text, outline:'none', marginBottom:20}} />
            <div style={{display:'flex', gap:10}}>
              <button onClick={() => setShowSubModal(false)} style={{padding:12, borderRadius:12, border:'none', background: theme.hover, color: theme.text}}>Cancelar</button>
              <button onClick={handleAddSubject} style={{flex:1, padding:12, background:primary, color:'white', border:'none', borderRadius:12, fontWeight:'bold', cursor:'pointer'}}>Adicionar</button>
            </div>
          </Modal></ModalOverlay>
        )}

        {editingNote && (
          <ModalOverlay onClick={() => setEditingNote(null)}>
            <Modal onClick={e => e.stopPropagation()} style={{maxWidth: 600}}>
              <input value={editingNote.title} onChange={e => setEditingNote({...editingNote, title: e.target.value})} style={{width:'100%', border:'none', background:'transparent', fontSize:22, fontWeight:'bold', color:theme.text, outline:'none', marginBottom:15}} />
              <textarea value={editingNote.content} onChange={e => setEditingNote({...editingNote, content: e.target.value})} style={{width:'100%', border:'none', background:'transparent', fontSize:16, color:theme.text, outline:'none', minHeight:200, resize:'none'}} />
              <div style={{display:'flex', justifyContent:'flex-end', marginTop:20}}>
                <button onClick={() => { handleUpdateNote(editingNote.id, {title: editingNote.title, content: editingNote.content, lastEdited: getTime()}); setEditingNote(null); }} style={{background:primary, color:'white', border:'none', padding:'10px 25px', borderRadius:10, fontWeight:'bold', cursor:'pointer'}}>Salvar Alterações</button>
              </div>
            </Modal>
          </ModalOverlay>
        )}

        {showSettings && (
          <ModalOverlay onClick={() => setShowSettings(false)}><Modal onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <h3 style={{margin:0}}>Ajustes</h3>
              <MdClose size={24} cursor="pointer" onClick={() => setShowSettings(false)}/>
            </div>
            <div onClick={() => setIsDark(!isDark)} style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:theme.hover, padding:15, borderRadius:15, cursor:'pointer'}}>
              <span style={{fontWeight:'bold'}}>{isDark ? 'Modo Escuro' : 'Modo Claro'}</span>
              {isDark ? <MdDarkMode size={22} color={primary}/> : <MdLightMode size={22} color={primary}/>}
            </div>
          </Modal></ModalOverlay>
        )}
      </Layout>
    </ThemeProvider>
  );
}