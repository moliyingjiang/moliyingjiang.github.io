---
layout: post
title:  "Java POI Excel移动行和复制行的处理"
categories: ['POI']
tags: ['java','POI','excel'] 
author: YJ-MoLi
description: Java POI Excel移动行和复制行的处理
issueId: 2019-6-27 POI Excel moving and replicating rows

---
* TOC
{:toc}

# Java POI Excel移动行和复制行的处理

POI操作Excel时，不支持移动行的操作，因此在需要通过复制行+删除行+创建空白行的组合方式来达成移动行的效果。

## 坑点：
- POI操作Excel文档和Excel软件操作文档的理解是不一样的,Excel软件日常操作时不是严格区分`空白行`和`空行`，而POI操作时必须严格区分，空白行可以直接操作，而空行则必须先执行创建行操作后才能操作。
- `copyRows` 复制行从源位置到目标位置时，不是完全覆盖模式，因此如果目标区域有内容，会用源区域有内容的部分替换到目标区域的内容，源区域没有内容的部分仍会使用目标区域的内容。这个和Excel软件操作中复制区域粘贴到指定区域的操作的效果是不同的。另外`copyRows`的会忽略起始区域是`空行`的行，例如如果想将`3-5`行开始复制到`7-9`行，如果`3、4`行是`空行`,那么拷贝后的结果为为`7`行为`5`行的内容。
- `removeRow` 删除行时，只会删除行的数据，对于行的合并单元格等数据不会删除，因为合并单元格是存放在`sheet`上。因此如果想同时删除合并单元格，则需要先手动删除合并单元格，再删除行。由于合并单元格数据是存放在一个list上的，而删除只提供下标删除方式，因此删除时需要按照下标大小倒序删除。
- `copyRows`  可以将源行的内容和样式都拷贝到目标行。
- 使用复制行+删除行+创建空白行组合方式达到移动行的效果时，需要注意临时区域的位置，保证临时区域不会和最终结果有重叠区域。

## 实现的代码

```java
if(CollectionUtils.isNotEmpty(dataList)) {
            int beginRowNo = data.getBeginRow();
            Row beginRow = sheet.getRow(beginRowNo);
            int addNo = dataList.size();
            int moveBeginRow = beginRowNo+1;
            //如果移动的开始行不存在，则创建一个空行，否则复制的时候会丢掉不存在的行
            if(sheet.getRow(moveBeginRow)==null){
                sheet.createRow(moveBeginRow);
            }
            int lastRowNo = sheet.getLastRowNum();

            //计算移动的行数
            int movedNo = lastRowNo-moveBeginRow+1;
            //临时区的开始行
            int tempBeginRowNo = lastRowNo+addNo+1;
            //临时区的结束行
            int tempLastRowNo = tempBeginRowNo+movedNo-1;
            //末尾部分的最终开始行
            int finalBeginRowNo = addNo+beginRowNo;

            //移动开始行以后的行到临时的开始行
            moveRows(sheet,moveBeginRow,lastRowNo,tempBeginRowNo);
            //在空出位置插入新行并复制第一行的样式
            for (int i = moveBeginRow; i <finalBeginRowNo; i++){
                Row row = sheet.getRow(i);
                if (row != null){
                    sheet.removeRow(row);
                }
                //创建空白的行
                sheet.createRow(i);
                if(beginRow!=null){
                    //复制第一行的样式到当前行
                    sheet.copyRows(beginRowNo,beginRowNo, i, DEFAULT_ROW_COPY_POLICY);
                }
            }
            //将移动的行从临时开始行回移新增好的行的末尾
            /*
              为什么不直接第一次移动的预期的末尾呢？是因为POX只支持Copy行的操作，而copy操作不是完整的区间覆盖。
              如果源区间内带有格式，并且目的区间和源区间有重叠话，会导致无法copy后源区间和目的区间混合在一起，无法清理。
              因此实现移动行区间的操作时，需要先将源行区间复制到一个临时的区域，然后清理掉源行区间的行和样式，再插入需要新增的行
              ，最后再将被移动的行区间移动回新的行末尾。
             */
            moveRows(sheet,tempBeginRowNo,tempLastRowNo,finalBeginRowNo);
 

        }

	/**
     * 移动指定行区间到指定位置，并删除移动后原地的行
     * @author 徐明龙 XuMingLong 2019-06-27
     * @param sheet
     * @param srcBeginRow
     * @param srcEndRow
     * @param destBeginRow
     * @return void
     */
    private static void moveRows(XSSFSheet sheet,int srcBeginRow,int srcEndRow,int destBeginRow){
        //先复制到目的位置
        sheet.copyRows(srcBeginRow, srcEndRow, destBeginRow, DEFAULT_ROW_COPY_POLICY);
        //清理之前残留的合并单元格
        List<Integer> removeMergedRegion = new ArrayList<>();
        for(int i=sheet.getMergedRegions().size()-1;i>=0;i--){
            CellRangeAddress address = sheet.getMergedRegions().get(i);
            //如果合并单元格在复制前的位置，则删除
            if(address.getFirstRow() >= srcBeginRow && address.getFirstRow()<destBeginRow ){
                removeMergedRegion.add(i);
            }
        };
        //执行清理合并的单元格
        for(Integer i:removeMergedRegion){
            sheet.removeMergedRegion(i);
        }
        //删除移动后原地的行
        for (int i = srcBeginRow; i <= srcEndRow; i++){
            Row row = sheet.getRow(i);
            if (row != null){
                //删除复制后残留的行
                sheet.removeRow(row);
            }
        }

    }

```