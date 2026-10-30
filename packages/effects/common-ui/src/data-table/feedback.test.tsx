import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useTranslation } from '@niubu/locales/react';
import { DataTable } from './DataTable';
import { createDataTableLabels } from './labels';
import { Loading } from '../read-state';
function Fixture({status='error',feedback=true,source=null,result=0,error,retry}:{status?:'pending'|'error'|'ready'|'cancelled';feedback?:boolean;source?:number|null;result?:number;error?:string;retry?:()=>void}){
 const {t}=useTranslation();return <DataTable profile="read" statePresentation={feedback?'feedback':undefined} caption="测试表格" columns={[{id:'name',accessorKey:'name',header:'名称'}]} getRowId={(row:{id:string;name:string})=>row.id} model={{kind:'client',rows:[]}} {...(status==='ready'?{readState:'ready',sourceCount:source,resultCount:result}:{readState:status,sourceCount:null,resultCount:null})} labels={{...createDataTableLabels(t),...(error?{error}:{})}} emptyAction={retry?<button onClick={retry}>重试当前表</button>:undefined}/>;
}
it('opts into one error with a unique action and switches to accessible loading without old error',()=>{
 const retry=vi.fn();const view=render(<Fixture retry={retry}/>);expect(screen.getAllByRole('alert')).toHaveLength(1);expect(screen.getByRole('heading',{name:'无法读取记录'})).toBeVisible();expect(screen.getAllByText('无法读取记录')).toHaveLength(1);expect(screen.getByText('本次未取得可用数据，可重新读取或返回工作空间。')).toBeVisible();expect(screen.queryByRole('link')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'重试当前表'}));expect(retry).toHaveBeenCalledOnce();view.rerender(<Fixture status="pending" retry={retry}/>);expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'重试当前表'})).not.toBeInTheDocument();expect(screen.getByRole('status',{name:'正在读取'})).toHaveAttribute('aria-busy','true');
 view.rerender(<Fixture error="当前资源暂不可用"/>);expect(screen.getByText('当前资源暂不可用')).toBeVisible();
});
it('leaves default loading/error and opted-in source empty, filtered empty, unknown and cancellation meanings unchanged',()=>{
 const view=render(<Fixture feedback={false}/>);expect(screen.getByRole('alert')).toHaveTextContent('无法读取记录');expect(screen.queryByRole('heading')).not.toBeInTheDocument();view.rerender(<Fixture feedback={false} status="pending"/>);expect(screen.getByRole('status')).toHaveTextContent('正在读取');expect(screen.getByRole('status')).not.toHaveAttribute('aria-label');
 view.rerender(<Fixture status="ready" source={0}/>);expect(screen.getByRole('status')).toHaveTextContent('暂无来源记录');view.rerender(<Fixture status="ready" source={5}/>);expect(screen.getByRole('status')).toHaveTextContent('没有匹配记录');view.rerender(<Fixture status="ready"/>);expect(screen.getByRole('status')).not.toHaveTextContent('正在读取');view.rerender(<Fixture status="cancelled"/>);expect(screen.getByRole('status')).toHaveTextContent('已取消加载');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('exports a live four-dot loading surface with decorative points and no request timer',()=>{
 const view=render(<Loading label="正在读取组织"/>);const state=screen.getByRole('status',{name:'正在读取组织'});expect(state).toHaveAttribute('aria-busy','true');expect(state).toHaveAttribute('aria-live','polite');expect(state.querySelector('[aria-hidden="true"]')!.children).toHaveLength(4);view.unmount();expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
