// Semua ikon aplikasi dari Lucide (lucide.dev). Komponen lain cukup impor dari sini
// supaya ukuran dan tebal garis seragam.
import {
  ArchiveRestore,
  Bold,
  Check,
  ChevronLeft,
  Code,
  Columns2,
  Database,
  DatabaseBackup,
  Ellipsis,
  FileOutput,
  FileText,
  Focus,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Heading2,
  Highlighter,
  Inbox,
  Italic,
  Layers,
  Link,
  ListChecks,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Settings,
  SquareCheckBig,
  Type,
  Strikethrough,
  Sun,
  Trash2,
  TriangleAlert,
  Underline,
  Unlink,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

type P = LucideProps & { size?: number };

const STROKE = 1.75;

function make(Icon: LucideIcon, defaultSize = 15, strokeWidth = STROKE) {
  const C = ({ size, ...p }: P) => <Icon size={size ?? defaultSize} strokeWidth={strokeWidth} aria-hidden {...p} />;
  C.displayName = Icon.displayName;
  return C;
}

// Navigasi dan layout
export const IconAll = make(Layers);
export const IconInbox = make(Inbox);
export const IconGroup = make(Folder);
export const IconGroupAdd = make(FolderPlus);
export const IconTrash = make(Trash2);
export const IconSettings = make(Settings);
export const IconSidebar = make(PanelLeft, 16);
export const IconList = make(Columns2, 16);
export const IconFocus = make(Focus);
export const IconBack = make(ChevronLeft, 16);
export const IconSearch = make(Search);
export const IconSearchEmpty = make(SearchX);
export const IconMore = make(Ellipsis);

// Card
export const IconNote = make(FileText, 14);
export const IconTodo = make(SquareCheckBig, 14);
export const IconTodoList = make(ListChecks, 14);
export const IconPlus = make(Plus, 13, 2.25);
export const IconCheck = make(Check, 12, 3);
export const IconClose = make(X, 14);
export const IconGrip = make(GripVertical, 14);
export const IconLink = make(Link);
export const IconUnlink = make(Unlink);
export const IconRestore = make(RotateCcw);
export const IconRename = make(Pencil, 13);
export const IconWarning = make(TriangleAlert, 16);

const PinBase = make(Pin);
export const IconPin = ({ filled, ...p }: P & { filled?: boolean }) => <PinBase fill={filled ? "currentColor" : "none"} {...p} />;

// Editor
export const IconBold = make(Bold, 15, 2.25);
export const IconItalic = make(Italic, 15, 2);
export const IconUnderline = make(Underline, 15, 2);
export const IconStrike = make(Strikethrough, 15, 2);
export const IconHighlight = make(Highlighter, 15, 2);
export const IconCode = make(Code, 15, 2);
export const IconHeading = make(Heading2, 15, 2);

// Pengaturan
export const IconPalette = make(Palette, 14);
export const IconText = make(Type, 14);
export const IconData = make(Database, 14);
export const IconFolderOpen = make(FolderOpen, 14);
export const IconBackup = make(DatabaseBackup, 14);
export const IconExport = make(FileOutput, 14);
export const IconArchive = make(ArchiveRestore, 14);
export const IconSun = make(Sun, 14);
export const IconMoon = make(Moon, 14);
export const IconMonitor = make(Monitor, 14);
