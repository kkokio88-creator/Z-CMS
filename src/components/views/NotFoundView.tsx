import React from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { DynamicIcon } from '../ui/icon';

export const NotFoundView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-10 text-center">
      <DynamicIcon name="search_off" size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
        페이지를 찾을 수 없습니다
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Button asChild>
        <Link to="/">대시보드로 돌아가기</Link>
      </Button>
    </div>
  );
};
