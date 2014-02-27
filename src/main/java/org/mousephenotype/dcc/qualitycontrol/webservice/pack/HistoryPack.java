/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.mousephenotype.dcc.qualitycontrol.webservice.pack;

import java.util.List;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlSeeAlso;
import javax.xml.bind.annotation.XmlType;
import org.mousephenotype.dcc.entities.qc.HistoryEntry;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@XmlSeeAlso(HistoryEntry.class)
@XmlType(propOrder = {"success", "total", "history"})
public class HistoryPack extends AbstractRestResponse<HistoryEntry> {

    @Override
    @XmlElement(name = "history")
    public List<HistoryEntry> getDataSet() {
        return super.getDataSet();
    }
}
