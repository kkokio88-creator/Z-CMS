import React from 'react';
import { NavLink } from 'react-router';
import { ViewType, useUI } from '../../contexts/UIContext';
import { DynamicIcon } from '../ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Sheet, SheetContent } from '../ui/sheet';
import { ChevronDown, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../config/routeConfig';

interface DataAvailability {
  sales: boolean;
  purchases: boolean;
  inventory: boolean;
  production: boolean;
  bom: boolean;
}

interface SidebarProps {
  dataAvailability?: DataAvailability;
}

const NavItem = ({
  icon,
  label,
  to,
  hasData = true,
  noDataMessage,
  onClick,
}: {
  icon: string;
  label: string;
  to: string;
  hasData?: boolean;
  noDataMessage?: string;
  onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end={to === '/'}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md group transition-colors mb-1',
        isActive
          ? 'bg-primary/10 text-primary dark:text-green-400'
          : 'text-muted-foreground hover:bg-accent'
      )
    }
    title={!hasData ? noDataMessage : undefined}
  >
    {({ isActive }) => (
      <>
        <DynamicIcon
          name={icon}
          size={18}
          className={cn(
            'mr-3',
            isActive ? 'text-primary dark:text-green-400' : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
        <span className="flex-1 text-left">{label}</span>
      </>
    )}
  </NavLink>
);

const NavSection = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <div className="mt-4">
    <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ dataAvailability }) => {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const hasSalesData = dataAvailability?.sales ?? false;
  const hasInventoryData = dataAvailability?.inventory ?? false;
  const hasBomData = dataAvailability?.bom ?? false;
  const hasProductionData = dataAvailability?.production ?? false;

  const closeMobile = () => {
    if (isSidebarOpen) toggleSidebar();
  };

  const sidebarContent = (
    <aside className="w-64 bg-card border-r flex flex-col shrink-0 transition-colors duration-200 h-full">
      <NavLink
        to="/"
        className="h-16 flex items-center px-6 border-b cursor-pointer"
        onClick={closeMobile}
      >
        <span className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Z-CMS <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </NavLink>

      <ScrollArea className="flex-1 py-4 px-3">
        <NavSection title="메인">
          <NavItem
            icon="dashboard"
            label="통합 관제 대시보드"
            to={ROUTES.home.path}
            onClick={closeMobile}
          />
        </NavSection>

        <NavSection title="분석">
          <NavItem
            icon="payments"
            label="수익 분석"
            to={ROUTES.profit.path}
            hasData={hasSalesData}
            noDataMessage="판매 데이터 필요"
            onClick={closeMobile}
          />
          <NavItem
            icon="analytics"
            label="매출 분석"
            to={ROUTES.sales.path}
            hasData={hasSalesData}
            noDataMessage="판매 데이터 필요"
            onClick={closeMobile}
          />
          <NavItem
            icon="account_balance"
            label="원가 관리"
            to={ROUTES.cost.path}
            onClick={closeMobile}
          />
        </NavSection>

        <NavSection title="운영">
          <NavItem
            icon="precision_manufacturing"
            label="생산/BOM 관리"
            to={ROUTES.production.path}
            hasData={hasBomData || hasProductionData}
            noDataMessage="생산/BOM 데이터 필요"
            onClick={closeMobile}
          />
          <NavItem
            icon="inventory_2"
            label="재고/발주 관리"
            to={ROUTES.inventory.path}
            hasData={hasInventoryData}
            noDataMessage="재고 데이터 필요"
            onClick={closeMobile}
          />
        </NavSection>

        <NavSection title="시스템">
          <NavItem
            icon="settings"
            label="설정 (AI/기준)"
            to={ROUTES.settings.path}
            onClick={closeMobile}
          />
        </NavSection>
      </ScrollArea>

      <Separator />
      <div className="p-4">
        <div className="flex items-center w-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://picsum.photos/100/100" alt="User Avatar" />
            <AvatarFallback>박</AvatarFallback>
          </Avatar>
          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">박종철</p>
            <p className="text-xs text-muted-foreground truncate">생산 관리자</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="설정"
          >
            <NavLink to={ROUTES.settings.path} onClick={closeMobile}>
              <Settings className="h-4 w-4" />
            </NavLink>
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">{sidebarContent}</div>

      {/* Mobile Sheet sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={(open) => !open && toggleSidebar()}>
        <SheetContent side="left" className="p-0 w-64">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
};
