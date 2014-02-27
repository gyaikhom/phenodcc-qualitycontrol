#! /bin/bash

pandoc -o manual.html --toc --self-contained -H style.html manual.md;
