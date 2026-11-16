import * as k8s from '@kubernetes/client-node';
import k3s from './kubernetes-api.adapter';

class NodeResourceAdapter {
  getNodes() {
    return k8s.topNodes(k3s.core);
  }

  getMetrics() {
    return k3s.metrics.getNodeMetrics();
  }

  getSummary(name: string) {
    return k3s.getNodeSummary(name);
  }
}
export default new NodeResourceAdapter();
