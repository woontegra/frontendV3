import { useState, useEffect, useRef, useCallback, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { 
  User, 
  FileText, 
  CreditCard, 
  Settings, 
  LogOut,
  ChevronDown,
  Camera
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/context/AuthContext";
import UploadAvatarDialog from "@/components/profile/UploadAvatarDialog";
import {
  getStoredAvatarBase64,
  isAdminRole,
  isPlaceholderAvatarDimensions,
  resolveProfilePictureUrl,
  roleDisplayLabel,
} from "@/shared/utils/profilePicture";

interface UserMenuProps {
  user: AuthUser;
  logout: () => void;
}

export default function UserMenu({ user, logout }: UserMenuProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const syncAvatar = useCallback(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }
    setAvatarUrl(
      resolveProfilePictureUrl(user.id, user.profilePicture, user.profilePictureUrl),
    );
  }, [user?.id, user?.profilePicture, user?.profilePictureUrl]);

  useEffect(() => {
    syncAvatar();
  }, [syncAvatar]);

  useEffect(() => {
    const onAuthChanged = () => syncAvatar();
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [syncAvatar]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const displayName = user?.name?.trim() || user?.email || "Hesabım";
  const displayEmail = user?.email || "";
  const roleLabel = roleDisplayLabel(user?.role, user?.tenantId);
  const showAdminBadge = isAdminRole(user?.role, user?.tenantId);

  const initials = (user?.name?.trim() || user?.email || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleAvatarChange = (url: string | null) => {
    setAvatarUrl(url);
  };

  const handleAvatarError = () => {
    const base64 = getStoredAvatarBase64(user?.id);
    if (base64 && avatarUrl !== base64) {
      setAvatarUrl(base64);
      return;
    }
    setAvatarUrl(null);
  };

  const handleAvatarLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (isPlaceholderAvatarDimensions(img.naturalWidth, img.naturalHeight)) {
      handleAvatarError();
    }
  };

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 1000) as unknown as number;
  };

  return (
    <div className="relative">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-lg",
              "hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            )}
            aria-label="Kullanıcı menüsü"
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? (
                <>
                  <AvatarImage
                    src={avatarUrl}
                    alt={displayName}
                    onLoad={handleAvatarLoad}
                    onError={handleAvatarError}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </>
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="hidden md:flex md:flex-col md:items-start md:leading-tight">
              <span className="text-sm text-gray-700 dark:text-gray-200">{displayName}</span>
              {showAdminBadge ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Admin
                </span>
              ) : (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{roleLabel}</span>
              )}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className={cn(
            "w-[320px] p-0 mt-2",
            "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl",
            "backdrop-blur-sm bg-opacity-95"
          )}
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* User Info Section */}
          <div className="px-5 py-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700 rounded-t-xl">
            <div className="flex items-start gap-3">
              <div 
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDialogOpen(true);
                }}
              >
                <Avatar className="h-12 w-12 border-2 border-white shadow-md ring-2 ring-gray-100 transition-all duration-200 group-hover:ring-blue-300 dark:group-hover:ring-blue-500 group-hover:scale-105">
                  {avatarUrl ? (
                    <>
                      <AvatarImage
                        src={avatarUrl}
                        alt={displayName}
                        onLoad={handleAvatarLoad}
                        onError={handleAvatarError}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-base font-semibold">
                        {initials}
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-base font-semibold">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/* Hover Overlay */}
                <div className={cn(
                  "absolute inset-0 rounded-full bg-black/50 dark:bg-black/70",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  "cursor-pointer"
                )}
                onClick={() => setIsDialogOpen(true)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-xs text-white font-medium">Profil resmi yükle</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{displayName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</div>
                {showAdminBadge ? (
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Admin
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-[10px] text-gray-500 dark:text-gray-400">{roleLabel}</span>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <DropdownMenuItem asChild>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Profilim</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile?tab=saved"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Kayıtlı Hesaplamalarım</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile?tab=subscription"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <CreditCard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Abonelik Bilgilerim</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Ayarlar</span>
              </Link>
            </DropdownMenuItem>
          </div>

          {/* Separator */}
          <Separator className="bg-gray-200 dark:bg-gray-700" />

          {/* Logout Button */}
          <div className="p-2">
            <DropdownMenuItem asChild>
              <button
                type="button"
                onClick={() => logout()}
                className={cn(
                  "w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm",
                  "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20",
                  "transition-colors cursor-pointer"
                )}
              >
                <LogOut className="h-4 w-4" />
                <span>Çıkış Yap</span>
              </button>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <UploadAvatarDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        currentAvatarUrl={avatarUrl}
        onAvatarChange={handleAvatarChange}
        userName={displayName}
      />
    </div>
  );
}

