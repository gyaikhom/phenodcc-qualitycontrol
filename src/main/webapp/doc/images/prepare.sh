#! /bin/bash

rm -Rf shadowed resized;
mkdir shadowed resized;

for x in `ls raw/*.png`;
do
    echo Preparing $x ...;
    fn=`basename $x`;
    convert $x -crop +4+77 -crop -4-4 cropped.png;
    convert cropped.png \( +clone -background '#ddd' -shadow 80x3-6-0 \) +swap -background white \
        \( +clone -background '#ddd' -shadow 80x3-0-6 \) +swap -background white \
        \( +clone -background '#ddd' -shadow 80x3+6+0 \) +swap -background white \
        \( +clone -background '#ddd' -shadow 80x3+0+6 \) +swap -background white \
        -layers merge +repage shadowed/${fn};
    convert shadowed/${fn} -resize 60% -unsharp 1 resized/${fn};
done;

rm -f cropped.png;
